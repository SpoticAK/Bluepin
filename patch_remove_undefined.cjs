const fs = require('fs');
let code = fs.readFileSync('src/store.tsx', 'utf8');

const oldRemoveUndefined = `function removeUndefined<T>(obj: T): T {
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
}`;

const newRemoveUndefined = `function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  // Check if it's a Firebase FieldValue or Date to prevent breaking it
  if (typeof obj === 'object' && (obj.constructor.name === 'FieldValueImpl' || obj.constructor.name === 'ServerTimestampTransform' || obj.constructor.name === 'FieldValue' || obj instanceof Date || (obj as any).isEqual)) {
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
}`;

code = code.replace(oldRemoveUndefined, newRemoveUndefined);
fs.writeFileSync('src/store.tsx', code);
