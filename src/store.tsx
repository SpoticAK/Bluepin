import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { AppState, GlucoseReading, LabReport, WeightEntry, Goal, GoalLog, UserProfile, Family, FamilySummary } from "./types";
import { DEFAULT_GOALS, DUMMY_GLUCOSE_READINGS } from "./data";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, collection, onSnapshot, setDoc, deleteDoc, serverTimestamp, updateDoc, getDoc, getDocs, deleteField, runTransaction, writeBatch, query, orderBy, limit } from "firebase/firestore";
import { buildFamilySummary } from "./lib/familyUtils";

const defaultState: AppState = {
  glucoseReadings: DUMMY_GLUCOSE_READINGS,
  labReports: [],
  weightEntries: [],
  goals: DEFAULT_GOALS,
  goalLogs: {},
  profile: { heightCm: 170 }, // Default height
  deletedDummyGlucoseIds: [],
  family: null,
  familySummaries: {},
};

interface AppContextType extends AppState {
  addGlucoseReading: (reading: GlucoseReading) => void;
  removeGlucoseReading: (id: string) => void;
  addLabReport: (report: LabReport) => void;
  updateLabReport: (id: string, updates: Partial<LabReport>) => void;
  removeLabReport: (id: string) => void;
  addWeightEntry: (entry: WeightEntry) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  toggleGoalActive: (goalId: string, isActive: boolean) => void;
  addCustomGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;
  logGoal: (date: string, goalId: string, completed: boolean, value?: number) => void;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (invitationId: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  createInvitation: () => Promise<string | null>;
  loadMemberDetailedData: (memberId: string) => Promise<Partial<AppState>>;
}

function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if ((obj as any)[key] !== undefined) {
          newObj[key] = removeUndefined((obj as any)[key]);
        }
      }
    }
    return newObj as T;
  }
  return obj;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(defaultState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const unsubProfile = onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setState(s => ({ ...s, profile: { heightCm: data.height || 170, ...data } }));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, "users/" + uid));

    const unsubGlucose = onSnapshot(collection(db, `users/${uid}/glucoseReadings`), (snapshot) => {
      const readings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Inject dummy data for demonstration
      setState(s => {
        const deletedIds = s.deletedDummyGlucoseIds || [];
        const combined = [...DUMMY_GLUCOSE_READINGS.filter(d => !deletedIds.includes(d.id)), ...readings];
        return { ...s, glucoseReadings: combined };
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/glucoseReadings`));

    const unsubReports = onSnapshot(collection(db, `users/${uid}/labReports`), (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setState(s => ({ ...s, labReports: reports }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/labReports`));

    const unsubWeight = onSnapshot(collection(db, `users/${uid}/weightLogs`), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setState(s => ({ ...s, weightEntries: logs }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/weightLogs`));

    const unsubGoals = onSnapshot(collection(db, `users/${uid}/goals`), (snapshot) => {
      const loadedGoals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const mergedGoals = [...DEFAULT_GOALS];
      loadedGoals.forEach(loaded => {
        const idx = mergedGoals.findIndex(g => g.id === loaded.id);
        if (idx !== -1) {
          mergedGoals[idx] = { ...mergedGoals[idx], ...loaded };
        } else {
          mergedGoals.push(loaded);
        }
      });
      setState(s => ({ ...s, goals: mergedGoals }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/goals`));

    const unsubLogs = onSnapshot(collection(db, `users/${uid}/dailyLogs`), (snapshot) => {
      const logs: any = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!logs[data.date]) logs[data.date] = {};
        logs[data.date][data.goalId] = { completed: data.completed, value: data.value, updatedAt: data.updatedAt };
      });
      setState(s => ({ ...s, goalLogs: logs }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/dailyLogs`));

    setLoading(false);
    return () => {
      unsubProfile(); unsubGlucose(); unsubReports(); unsubWeight(); unsubGoals(); unsubLogs();
    };
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const s = stateRef.current;
    if (!s.profile.familyId) return;

    const newSummary = buildFamilySummary(s);
    newSummary.userId = uid;
    newSummary.name = s.profile.name || 'Anonymous';
    newSummary.avatarColor = s.profile.profileColor;
    newSummary.photoUrl = s.profile.photoUrl;

    const existing = s.familySummaries[uid];
    
    let shouldSync = false;
    if (!existing) {
      shouldSync = true;
    } else {
      const keys = ['healthScore', 'bmi', 'currentWeight', 'currentStreak', 'highestStreak', 'latestGlucose', 'latestGlucoseType', 'hba1c', 'glucoseEnabled', 'name', 'avatarColor', 'photoUrl'];
      for (const k of keys) {
        if (newSummary[k] !== existing[k]) {
          shouldSync = true;
          break;
        }
      }
      if (!shouldSync && (JSON.stringify(newSummary.recentStreak) !== JSON.stringify(existing.recentStreak) || JSON.stringify(newSummary.careReminders) !== JSON.stringify(existing.careReminders))) {
        shouldSync = true;
      }
    }

    if (shouldSync) {
      const ref = doc(db, `users/${uid}/familySummary/latest`);
      setDoc(ref, removeUndefined(newSummary)).catch(e => console.error(e)); setState(s => ({ ...s, familySummaries: { ...s.familySummaries, [uid]: newSummary as any } }));
    }
  }, [state.glucoseReadings, state.labReports, state.weightEntries, state.goals, state.goalLogs, state.profile.name, state.profile.profileColor, state.profile.photoUrl, state.profile.glucoseEnabled, state.profile.familyId, state.profile.heightCm]);

  // Family listeners
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const familyId = state.profile.familyId;
    
    let unsubFamily = () => {};
    let unsubSummaries = {} as Record<string, () => void>;

    if (familyId) {
      unsubFamily = onSnapshot(doc(db, 'families', familyId), (docSnap) => {
        if (docSnap.exists()) {
          const famData = { id: docSnap.id, ...docSnap.data() } as any;
          setState(s => ({ ...s, family: famData }));
          
          // Sync summaries
          const members = Object.keys(famData.members || {});
          
          // Remove old listeners
          Object.keys(unsubSummaries).forEach(memberId => {
            if (!members.includes(memberId)) {
              unsubSummaries[memberId]();
              delete unsubSummaries[memberId];
              setState(s => {
                const newSums = { ...s.familySummaries };
                delete newSums[memberId];
                return { ...s, familySummaries: newSums };
              });
            }
          });

          // Add new listeners
          members.forEach(memberId => {
            if (memberId !== uid && !unsubSummaries[memberId]) {
              unsubSummaries[memberId] = onSnapshot(doc(db, `users/${memberId}/familySummary/latest`), (sumSnap) => {
                if (sumSnap.exists()) {
                  setState(s => ({
                    ...s,
                    familySummaries: { ...s.familySummaries, [memberId]: sumSnap.data() as any }
                  }));
                }
              });
            }
          });

        } else {
          setState(s => ({ ...s, family: null, familySummaries: {} }));
        }
      });
    } else {
      setState(s => ({ ...s, family: null, familySummaries: {} }));
    }

    return () => {
      unsubFamily();
      Object.values(unsubSummaries).forEach(unsub => unsub());
    };
  }, [state.profile.familyId]);


  const uid = auth.currentUser?.uid;

  
  const updateLimits = async (batch: any, type: 'glucose' | 'report_add' | 'report_delete', userId: string, deletedReportId?: string) => {
    const limitsRef = doc(db, `users/${userId}/stats/limits`);
    const snap = await getDoc(limitsRef);
    const data = snap.exists() ? snap.data() : {};

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    let updatePayload: any = {};

    if (type === 'glucose') {
      const isNewDay = data.gYear !== year || data.gMonth !== month || data.gDay !== day;
      const currentCount = isNewDay ? 0 : (data.gCount || 0);
      
      if (currentCount >= 10) {
        throw new Error("Daily limit of 10 glucose readings exceeded.");
      }
      
      updatePayload = {
        gYear: year,
        gMonth: month,
        gDay: day,
        gCount: currentCount + 1
      };
    } else if (type === 'report_add') {
      const isNewDay = data.rYear !== year || data.rMonth !== month || data.rDay !== day;
      const currentCount = isNewDay ? 0 : (data.rCount || 0);
      const totalCount = data.rTotal || 0;
      
      if (currentCount >= 20) {
        throw new Error("Daily limit of 20 health reports exceeded.");
      }
      if (totalCount >= 100) {
        throw new Error("Maximum limit of 100 health reports exceeded.");
      }
      
      updatePayload = {
        rYear: year,
        rMonth: month,
        rDay: day,
        rCount: currentCount + 1,
        rTotal: totalCount + 1
      };
    } else if (type === 'report_delete') {
      const totalCount = data.rTotal || 0;
      updatePayload = {
        rTotal: Math.max(0, totalCount - 1),
        deletedReportId: deletedReportId
      };
    }

    batch.set(limitsRef, updatePayload, { merge: true });
  };


  const addGlucoseReading = async (reading: GlucoseReading) => {
    if (reading.value < 0 || reading.value > 1000 || isNaN(reading.value)) {
      throw new Error("Invalid glucose value. Must be between 0 and 1000.");
    }
    if (!uid) {
      setState(s => ({ ...s, glucoseReadings: [reading, ...s.glucoseReadings] }));
      return;
    }
    try {
      const batch = writeBatch(db);
      await updateLimits(batch, 'glucose', uid);
      const ref = doc(db, `users/${uid}/glucoseReadings`, reading.id);
      batch.set(ref, removeUndefined({
        ...reading,
        userId: uid,
        createdAt: serverTimestamp()
      }));
      await batch.commit();
    } catch (e: any) {
      alert(e.message || "Failed to add glucose reading");
      handleFirestoreError(e, OperationType.CREATE, `users/${uid}/glucoseReadings`);
    }
  };
  const removeGlucoseReading = async (id: string) => {
    if (id.startsWith('dummy-') || !uid) {
      setState(s => {
        const deletedIds = [...(s.deletedDummyGlucoseIds || []), id];
        const combined = s.glucoseReadings.filter(r => r.id !== id);
        return { ...s, glucoseReadings: combined, deletedDummyGlucoseIds: deletedIds };
      });
      return;
    }
    await deleteDoc(doc(db, `users/${uid}/glucoseReadings`, id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/glucoseReadings/${id}`));
  };

  const addLabReport = async (report: LabReport) => {
    if (!uid) return;
    try {
      const batch = writeBatch(db);
      await updateLimits(batch, 'report_add', uid);
      const ref = doc(db, `users/${uid}/labReports`, report.id);
      batch.set(ref, removeUndefined({
        ...report,
        userId: uid,
        createdAt: serverTimestamp()
      }));
      // also we need to add biomarkers if they exist
      for (const bm of report.biomarkers) {
        const safeId = bm.name.replace(/[^a-zA-Z0-9]/g, "");
        const bmRef = doc(db, `users/${uid}/biomarkers`, `${report.id}_${safeId}`);
        batch.set(bmRef, removeUndefined({
          userId: uid,
          reportId: report.id,
          name: bm.name,
          value: bm.value,
          reportDate: report.date,
          status: bm.status,
          createdAt: serverTimestamp()
        }));
      }
      await batch.commit();
    } catch (e: any) {
      alert(e.message || "Failed to add report");
      handleFirestoreError(e, OperationType.CREATE, `users/${uid}/labReports`);
    }
  };
  const removeLabReport = async (id: string) => {
    if (!uid) return;
    try {
      const batch = writeBatch(db);
      await updateLimits(batch, 'report_delete', uid, id);
      const ref = doc(db, `users/${uid}/labReports`, id);
      batch.delete(ref);
      await batch.commit();
    } catch (e: any) {
      alert(e.message || "Failed to delete report");
      handleFirestoreError(e, OperationType.DELETE, `users/${uid}/labReports/${id}`);
    }
  };

  const updateLabReport = async (reportId: string, updates: Partial<LabReport>) => {
    if (!uid) return;
    const ref = doc(db, `users/${uid}/labReports`, reportId);
    await updateDoc(ref, removeUndefined({
      ...updates,
      updatedAt: serverTimestamp()
    })).catch(e => handleFirestoreError(e, OperationType.UPDATE, ref.path));
  };

  const addWeightEntry = async (entry: WeightEntry) => {
    if (!uid) return;
    const ref = doc(db, `users/${uid}/weightLogs`, entry.id);
    await setDoc(ref, removeUndefined({
      ...entry,
      userId: uid,
      createdAt: serverTimestamp()
    })).catch(e => handleFirestoreError(e, OperationType.CREATE, ref.path));
  };
  
  const updateProfile = async (profile: Partial<UserProfile>) => {
    if (!uid) return;
    const ref = doc(db, `users`, uid);
    await updateDoc(ref, removeUndefined({
      ...profile,
      updatedAt: serverTimestamp()
    })).catch(e => handleFirestoreError(e, OperationType.UPDATE, ref.path));
  };

  const toggleGoalActive = async (goalId: string, isActive: boolean) => {
    if (!uid) return;
    const existingGoal = state.goals.find(g => g.id === goalId);
    if (!existingGoal) return;
    const ref = doc(db, `users/${uid}/goals`, goalId);
    
    // Create local YYYY-MM-DD
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    await setDoc(ref, removeUndefined({
      ...existingGoal,
      userId: uid,
      isActive,
      status: isActive ? "active" : "archived",
      createdAt: existingGoal.createdAt || Date.now(),
      activeHistory: {
        ...(existingGoal.activeHistory || {}),
        [todayStr]: isActive
      }
    }), { merge: true }).catch(e => handleFirestoreError(e, OperationType.UPDATE, ref.path));
  };

  const addCustomGoal = async (goal: Goal) => {
    if (!uid) return;
    const ref = doc(db, `users/${uid}/goals`, goal.id);
    
    // Create local YYYY-MM-DD
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    await setDoc(ref, removeUndefined({
      ...goal,
      userId: uid,
      status: "active",
      createdAt: Date.now(),
      activeHistory: {
        [todayStr]: true
      }
    })).catch(e => handleFirestoreError(e, OperationType.CREATE, ref.path));
  };

  const removeGoal = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, `users/${uid}/goals`, id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${uid}/goals/${id}`));
  };

  const logGoal = async (date: string, goalId: string, completed: boolean, value?: number) => {
    if (!uid) return;
    const logId = `${date}_${goalId}`;
    const ref = doc(db, `users/${uid}/dailyLogs`, logId);
    await setDoc(ref, removeUndefined({
      userId: uid,
      goalId,
      date,
      completed,
      value: value || 0,
      createdAt: serverTimestamp(),
      updatedAt: Date.now()
    }), { merge: true }).catch(e => handleFirestoreError(e, OperationType.CREATE, ref.path));
  };


  const createFamily = async (name: string) => {
    if (!uid) return;
    try {
      const batch = writeBatch(db);
      const famRef = doc(collection(db, 'families'));
      batch.set(famRef, {
        name,
        createdAt: serverTimestamp(),
        members: {
          [uid]: { role: 'admin', joinedAt: Date.now() }
        }
      });
      batch.update(doc(db, 'users', uid), { familyId: famRef.id });
      await batch.commit();
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, `families`);
    }
  };

  const createInvitation = async () => {
    if (!uid || !state.family || !state.profile.familyId) return null;
    try {
      const invRef = doc(collection(db, 'invitations'));
      await setDoc(invRef, {
        familyId: state.profile.familyId,
        familyName: state.family.name,
        inviterId: uid,
        inviterName: state.profile.name || 'Anonymous',
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      });
      return invRef.id;
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, `invitations`);
      return null;
    }
  };

  const joinFamily = async (invitationId: string) => {
    if (!uid) return;
    try {
      await runTransaction(db, async (transaction) => {
        const invRef = doc(db, 'invitations', invitationId);
        const invSnap = await transaction.get(invRef);
        if (!invSnap.exists()) throw new Error('Invalid invitation');
        const invData = invSnap.data();
        if (invData.status !== 'pending' || invData.expiresAt < Date.now()) throw new Error('Expired invitation');
        
        const familyRef = doc(db, 'families', invData.familyId);
        const familySnap = await transaction.get(familyRef);
        if (!familySnap.exists()) throw new Error('Family does not exist');
        
        const userRef = doc(db, 'users', uid);
        
        transaction.update(familyRef, {
          [`members.${uid}`]: { role: 'member', joinedAt: Date.now() }, lastUsedInvitation: invitationId
        });
        transaction.update(userRef, { familyId: invData.familyId });
        transaction.update(invRef, { status: 'used', usedBy: uid, usedAt: Date.now() });
      });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `invitations/${invitationId}`);
    }
  };

  const leaveFamily = async () => {
    if (!uid || !state.profile.familyId) return;
    try {
      const batch = writeBatch(db);
      const fid = state.profile.familyId;
      const famRef = doc(db, 'families', fid);
      batch.update(famRef, {
        [`members.${uid}`]: deleteField()
      });
      batch.update(doc(db, 'users', uid), { familyId: null });
      await batch.commit();
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `families`);
    }
  };
  
  const loadMemberDetailedData = async (memberId: string) => {
    try {
      const gQ = query(collection(db, `users/${memberId}/glucoseReadings`), orderBy('date', 'desc'), limit(30));
      const gSnap = await getDocs(gQ);
      const glucoseReadings = gSnap.docs.map(d => ({id: d.id, ...d.data()}) as any);
      
      const wQ = query(collection(db, `users/${memberId}/weightLogs`), orderBy('date', 'desc'), limit(30));
      const wSnap = await getDocs(wQ);
      const weightEntries = wSnap.docs.map(d => ({id: d.id, ...d.data()}) as any);
      
      const rQ = query(collection(db, `users/${memberId}/labReports`), orderBy('date', 'desc'), limit(5));
      const rSnap = await getDocs(rQ);
      const labReports = rSnap.docs.map(d => ({id: d.id, ...d.data()}) as any);

      const goalSnap = await getDocs(collection(db, `users/${memberId}/goals`));
      const loadedGoals = goalSnap.docs.map(d => ({id: d.id, ...d.data()}) as any);
      const goals = [...DEFAULT_GOALS];
      loadedGoals.forEach(loaded => {
        const idx = goals.findIndex(g => g.id === loaded.id);
        if (idx !== -1) {
          goals[idx] = { ...goals[idx], ...loaded };
        } else {
          goals.push(loaded);
        }
      });

      const lQ = query(collection(db, `users/${memberId}/dailyLogs`), orderBy('date', 'desc'), limit(100));
      const logSnap = await getDocs(lQ);
      const goalLogs: any = {};
      logSnap.docs.forEach(d => {
        const data = d.data();
        if (!goalLogs[data.date]) goalLogs[data.date] = {};
        goalLogs[data.date][data.goalId] = { completed: data.completed, value: data.value };
      });

      return {
        glucoseReadings,
        weightEntries,
        labReports,
        goals,
        goalLogs
      };
    } catch(e) {
      console.error("Failed to load member data", e);
      return {};
    }
  };

  if (loading) return null;


  return (
    <AppContext.Provider value={{
      ...state,
      addGlucoseReading, removeGlucoseReading,
      addLabReport, updateLabReport, removeLabReport,
      addWeightEntry,
      updateProfile,
      toggleGoalActive, addCustomGoal, removeGoal, logGoal,
      createFamily, joinFamily, leaveFamily, createInvitation, loadMemberDetailedData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
};
