const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add import for AdminFeedbackView
if (!content.includes('AdminFeedbackView')) {
  content = content.replace(/import \{ LegalDocType \} from '\.\/lib\/consentManager';/, "import { LegalDocType } from './lib/consentManager';\nimport AdminFeedbackView from './components/AdminFeedbackView';");
}

// 2. Add "admin" to TabType
content = content.replace(/type TabType = "dashboard" \| "glucose" \| "biomarkers";/, 'type TabType = "dashboard" | "glucose" | "biomarkers" | "admin";');

// 3. Add Settings/Admin icon if needed, but we already have Users or MessageSquare from lucide-react. MessageSquare is imported. Let's add Shield.
content = content.replace(/MessageSquare,/, 'MessageSquare, Shield,');

// 4. In MainLayout, determine if admin
if (!content.includes('const isAdmin = auth.currentUser?.email')) {
  content = content.replace(/const { theme, toggleTheme } = useTheme\(\);/, `const { theme, toggleTheme } = useTheme();\n  const isAdmin = auth.currentUser?.email === 'sparsh190204@gmail.com';`);
}

// 5. Add NavItem for Admin
const adminNav = `
          {isAdmin && (
            <NavItem
              icon={<Shield />}
              label="Admin"
              isActive={activeTab === "admin"}
              onClick={() => setActiveTab("admin")}
              isCollapsed={isSidebarCollapsed}
              colorClass="text-purple-500"
            />
          )}
          </nav>`;
content = content.replace(/<\/nav>/, adminNav);

// 6. Render Admin view
const adminView = `
        {activeTab === "admin" && isAdmin && <AdminFeedbackView />}
        <footer`;
content = content.replace(/<footer/, adminView);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched App.tsx");
