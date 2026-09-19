#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Kerjo (Bumble-style local work matching, Indonesia). This session: (P0) fix Matches avatar migration so legacy pravatar face URLs never leak (must show category icons). Then new features: Undo swipe, Job Post shortcut on Hiring screen, Chat unread badge, Online status in chat, Applicant list for employers, Phone calls in chat, Candidate screening questions, and Scheduling interview/first-day time slots."

backend:
  - task: "P0 Matches avatar migration + clean_avatar hardening"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added clean_avatar() to strip pravatar/randomuser/unsplash from images at read time in display_for + profile_to_card. Startup migration blanks legacy image/worker_avatar. Verified /api/matches returns empty image for all matches."
  - task: "Undo swipe endpoint POST /api/swipe/undo"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Deletes the swipe doc for given target. Verified returns {ok:true}."
  - task: "Unread count (per-match + total) and mark-read"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "list_matches now returns unread per match; GET /matches/unread-count total; POST /matches/{id}/read sets read_at.<uid>. Verified counts change."
  - task: "Applicants list GET /api/applicants"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns workers who right-swiped my jobs with screening answers, matched flag, match_id. Verified end-to-end."
  - task: "Online status + phone in GET /api/matches/{id}"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "last_seen updated on every authed request; is_online<120s. Phone resolves job_phone (worker view) / worker_phone (employer view). Verified."
  - task: "Scheduling: create + respond schedule messages"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "POST /matches/{id}/schedule inserts kind=schedule message; respond endpoint updates status + system message. Verified accept flow."
  - task: "Screening answers stored on swipe; questions on job"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "JobRequest gains phone+screening_questions; SwipeRequest gains screening_answers; surfaced in applicants. Verified."

frontend:
  - task: "Undo swipe button (Batal) on home"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Undo FAB appears when undoStack non-empty; restores card to front and deletes swipe. Not undoable after a match."
  - task: "Hiring screen shortcuts (Pelamar + Pasang Kerja)"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "hireBar shown only in Hiring mode; Pelamar navigates to /applicants with count badge; Pasang Kerja navigates to post tab."
  - task: "Chat unread badge on tab"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Polls unread-count every 5s; sets tabBarBadge on Chat tab (and NativeTabs badge)."
  - task: "Applicants screen"
    implemented: true
    working: "NA"
    file: "frontend/app/applicants.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Lists applicants with screening answers; Terima&Cocokkan triggers swipe->match; Buka Chat if matched."
  - task: "Chat online status + phone call + scheduling UI"
    implemented: true
    working: "NA"
    file: "frontend/app/chat/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Header shows 'sedang aktif' green dot when online; call button (tel:) when phone; Jadwalkan sheet (kind/date/time/note); schedule bubbles with Terima/Tolak; mark-read on open."
  - task: "Post job: phone + screening questions fields"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/post.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added phone input and up to 3 screening question inputs (add/remove)."
  - task: "Onboarding + screening apply flow phone"
    implemented: true
    working: "NA"
    file: "frontend/app/onboarding.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added phone field to worker profile; screening sheet on home collects answers before applying to jobs with questions."

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Undo swipe button (Batal) on home"
    - "Hiring screen shortcuts (Pelamar + Pasang Kerja)"
    - "Chat unread badge on tab"
    - "Applicants screen"
    - "Chat online status + phone call + scheduling UI"
    - "Post job: phone + screening questions fields"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented P0 avatar migration + 8 features. Backend all self-verified via API (undo, unread, applicants, online/phone, schedule accept, screening answers). Please test frontend flows using seeded tokens (see /app/memory/test_credentials.md): solo tokA/tokB two-sided flow. Focus: (1) Undo button restores last passed/liked card; (2) Hiring mode shows Pelamar + Pasang Kerja buttons and they navigate; (3) Chat tab shows unread badge and clears after opening chat; (4) /applicants lists applicants with screening answers and Terima&Cocokkan works; (5) chat header online dot + call + Jadwalkan schedule flow with Terima/Tolak; (6) Post job phone + screening question inputs. Also re-verify no human faces anywhere (all category icons). Backend already verified so prioritize frontend."