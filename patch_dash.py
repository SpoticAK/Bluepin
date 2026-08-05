import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add state for pinnedSection
state_code = """
  const [pinnedSection, setPinnedSection] = useState<'health'|'glucose'|'weight'>(() => (localStorage.getItem('pinnedSection') as any) || 'health');

  useEffect(() => {
    localStorage.setItem('pinnedSection', pinnedSection);
  }, [pinnedSection]);
"""
content = re.sub(r'const \[showQuickAdd, setShowQuickAdd\] = useState\(false\);', state_code + r'\n  const [showQuickAdd, setShowQuickAdd] = useState(false);', content, count=1)


# Health Snapshot Section
health_regex = r'(<section\s+onClick=\{\(\) => onNavigate\(\'biomarkers\'\)\}\s+className="bg-theme-card px-4 py-2 sm:px-6 sm:py-4 rounded-\[28px\] border border-theme-border/50 shadow-sm cursor-pointer hover:shadow-md transition-all relative group"\s+>)(.*?)(</section>)'
def replace_health(m):
    start_tag = m.group(1)
    inner = m.group(2)
    end_tag = m.group(3)
    pin_button = """
        <button 
          onClick={(e) => { e.stopPropagation(); setPinnedSection('health'); }}
          className={cn(
            "absolute top-4 left-4 w-4 h-4 rounded-full border-2 transition-colors z-20",
            pinnedSection === 'health' ? "bg-blue-500 border-blue-500" : "bg-transparent border-theme-border hover:border-blue-400"
          )}
          title="Pin to top"
        />
"""
    return f"{start_tag}{pin_button}{inner}{end_tag}"

content = re.sub(health_regex, replace_health, content, flags=re.DOTALL)


# Glucose Section
glucose_regex = r'\{isGlucoseTracking && \(\s*(<section\s+onClick=\{\(\) => onNavigate\(\'glucose\'\)\}\s+className="bg-theme-card px-5 py-5 sm:px-6 rounded-\[28px\] border border-theme-border/50 shadow-sm cursor-pointer hover:shadow-md transition-all group flex flex-col gap-4"\s+>\s*<div className="flex items-center justify-between">\s*<h2 className="text-\[17px\] font-bold text-theme-text">Glucose</h2>\s*</div>.*?)</section>\s*\)\}'

def replace_glucose(m):
    inner = m.group(1)
    # add pin button next to title
    # original: <h2 className="text-[17px] font-bold text-theme-text">Glucose</h2>
    # replace with: <div className="flex items-center gap-3"><button .../><h2 ...>Glucose</h2></div>
    pin_button = """<div className="flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); setPinnedSection('glucose'); }}
            className={cn(
              "w-4 h-4 rounded-full border-2 transition-colors",
              pinnedSection === 'glucose' ? "bg-blue-500 border-blue-500" : "bg-transparent border-theme-border hover:border-blue-400"
            )}
            title="Pin to top"
          />
          <h2 className="text-[17px] font-bold text-theme-text">Glucose</h2>
        </div>"""
    inner = inner.replace('<h2 className="text-[17px] font-bold text-theme-text">Glucose</h2>', pin_button)
    return inner + "</section>"

content = re.sub(glucose_regex, replace_glucose, content, flags=re.DOTALL)

# Weight Card replacement
content = content.replace('<WeightCard />', '<WeightCard isPinned={pinnedSection === \'weight\'} onPin={() => setPinnedSection(\'weight\')} />')

# Now to reorder them in the render tree, we need to extract the three sections and render them according to pinnedSection
# The sections are currently written out sequentially in the JSX.
# It might be easier to extract their JSX into variables right before the return statement of Dashboard, but since they contain a lot of code, 
# let's write a regex that extracts them from the return block.

health_full_regex = r'(<!-- 2\. HEALTH SNAPSHOT -->\s*<section.*?</section>)'
glucose_full_regex = r'(<!-- GLUCOSE DASHBOARD CARDS -->\s*<section.*?</section>)'
weight_full_regex = r'(<!-- WEIGHT CARD -->\s*<WeightCard.*?/>)'

health_match = re.search(r'\{\/\* 2\. HEALTH SNAPSHOT \*\/.*?</section>', content, flags=re.DOTALL)
glucose_match = re.search(r'\{\/\* GLUCOSE DASHBOARD CARDS \*\/.*?</section>', content, flags=re.DOTALL)
weight_match = re.search(r'\{\/\* WEIGHT CARD \*\/.*?</WeightCard.*?/>', content, flags=re.DOTALL)

if health_match and glucose_match and weight_match:
    print("Found all three sections")
else:
    print("Failed to find sections")

# We can replace the whole block where these 3 appear with a conditional rendering logic.
# Wait, weight_match might just be <WeightCard ... />. Let's use string replace.

health_str = health_match.group(0)
glucose_str = glucose_match.group(0)
weight_str = weight_match.group(0)

# Replace them with empty strings in the content
content = content.replace(health_str, '')
content = content.replace(glucose_str, '')
content = content.replace(weight_str, '')

# Now find the place where they were (after Daily Thought header) and insert the re-ordering logic
insert_point = '{/* 4. CARE REMINDERS */}'

reorder_logic = """
        {pinnedSection === 'health' && (
          <>
            """ + health_str + """
            """ + glucose_str + """
            """ + weight_str + """
          </>
        )}
        {pinnedSection === 'glucose' && (
          <>
            """ + glucose_str + """
            """ + health_str + """
            """ + weight_str + """
          </>
        )}
        {pinnedSection === 'weight' && (
          <>
            """ + weight_str + """
            """ + health_str + """
            """ + glucose_str + """
          </>
        )}
"""

content = content.replace(insert_point, reorder_logic + '\n        ' + insert_point)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)

