---
description: How to maintain PROJECT_MEMORY.md as a living document
---

# 🧠 Memory Update Workflow

This workflow ensures PROJECT_MEMORY.md stays current and useful across all sessions.

## 🔁 The Chain Reaction Cycle

### Step 1: START OF EVERY SESSION
```
// turbo-all
```

**ALWAYS do this first, before ANY other work:**

1. Open and read `PROJECT_MEMORY.md` from line 1
2. Check the "🔥 Recent Updates" section at top
3. Scan "Known Issues" to avoid duplicate investigation
4. Review "Last Session Work" to understand context

**Command**: 
```bash
# No command needed - just use view_file tool
```

---

### Step 2: DURING WORK (Continuous Updates)

**Update memory IMMEDIATELY when:**

✅ **Bug Fixed** → Add to "Known Issues & Fixes" section with date  
✅ **New Feature Added** → Update "Key Features" section  
✅ **File Modified** → Add to "Recent Updates" log at top  
✅ **Mistake Made** → Document in "Lessons Learned" section  
✅ **Configuration Changed** → Update relevant section  
✅ **Database Schema Changed** → Update "Database Schema" section  

**How to update**:
1. Open PROJECT_MEMORY.md
2. Find relevant section
3. Add new info with timestamp
4. Update "🔥 Recent Updates" log at top
5. Change "Last Updated" timestamp at bottom

---

### Step 3: END OF WORK SESSION

**Before calling notify_user or ending session:**

1. Update "Last Session Work" section with summary
2. Add any discovered issues to "Current Known Issues"
3. Document any new patterns or tips learned
4. Update "Next Steps" if applicable
5. Increment version if major changes made

---

### Step 4: START OF NEXT SESSION

**The cycle repeats** → Go back to Step 1

This creates a **chain reaction** where memory is:
- Always current ✅
- Always accessible ✅  
- Always improving ✅

---

## 📝 Quick Update Template

Use this when updating the "🔥 Recent Updates" section:

```markdown
### [YYYY-MM-DD HH:MM] - [Action: Fixed/Added/Changed/Discovered]
- **What**: Brief description
- **Where**: File(s) affected
- **Why**: Reason or root cause
- **Impact**: User-facing or internal
```

**Example**:
```markdown
### 2026-02-08 11:45 - Fixed: Team modal validation
- **What**: Added inline team name uniqueness check
- **Where**: `frontend/registration.html` line 1234-1256
- **Why**: Users could submit duplicate team names
- **Impact**: Prevents database constraint errors
```

---

## 🚨 Critical Rule

**NEVER skip reading PROJECT_MEMORY.md at session start!**

Even if you think you know the project, memory might have:
- Recent bug fixes you should know about
- New patterns to follow
- Issues to avoid
- Updated configuration

---

## 🎯 Benefits of This Chain

1. **No Lost Context** - Every session builds on previous knowledge
2. **Faster Debugging** - Known issues documented with solutions  
3. **Consistent Patterns** - Everyone follows same conventions
4. **Institutional Knowledge** - Mistakes documented and avoided
5. **Seamless Handoffs** - Account switches don't break flow

---

## 💡 Pro Tips

- Keep updates **concise** but **complete**
- Include **timestamps** for all updates
- Link to **specific files and line numbers** when possible
- Document **root causes**, not just symptoms
- Update **immediately** while context is fresh
- Use **emoji markers** for quick scanning (✅ ⚠️ 🐛 🚀 📝)

---

**Remember**: PROJECT_MEMORY.md is only valuable if it's kept current!
