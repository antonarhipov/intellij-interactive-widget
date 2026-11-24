# NotifyHub · IntelliJ IDEA scenario prototype

**[Open the interactive prototype](https://antonarhipov.com/intellij-interactive-widget/)** — available in a browser without installation or sign-in.

For local development, open **http://127.0.0.1:4173/**. The prototype is read-only.

To restart, run `npm start` in this directory. Node.js is the only runtime dependency; no installation or build is needed. The server binds to `127.0.0.1` and accepts GET and HEAD only. Use `PORT=4174 npm start` for another local port.

Git includes the runnable `dist/` snapshot, its local assets, fixtures and maintenance scripts. Generated screenshots and verification reports under `evidence/`, Playwright artifacts and local caches are ignored; the evidence paths below refer to local verification runs.

## Share without a server

Run `npm run build:static` once to create `release/notify-hub-prototype.html`. Send that HTML file to colleagues, optionally inside a ZIP. They can extract it and double-click it to open the full interactive prototype in their browser. They do not need Node.js, npm, a server, or an internet connection.

The single file embeds the project and library snapshots, both agent sessions, diffs, debugger state, full console log, icons, scripts, styles and JetBrains Mono font. It can be moved or renamed freely and also works on ordinary static hosting. Its content security policy prevents network connections. Like the local prototype, it is a read-only snapshot; it contains the included project/session data.

Regenerate the HTML after changing the implementation or refreshing the snapshots. `npm run verify:static` checks the exported artifact in an offline Chromium browser, including sources, sessions, both diff layouts, library sources, variables, console and AI Usage. The browser automation blocks `file:` navigation, so verification loads a moved copy of the HTML through an intercepted document request with networking disabled.

The initial portable export passed all 22 offline browser checks with no missing assets or runtime errors. Its screenshots and report are in `evidence/static-v13/2026-11-22T18-34-30.178Z/`. The regular served UI also passed all 50 editor regression checks after adding embedded asset support.

## GitHub Pages

The public site is **https://antonarhipov.com/intellij-interactive-widget/**, using this account's existing GitHub Pages domain. The **Deploy GitHub Pages** workflow runs on every push to `main` and can also be started manually from the repository's Actions tab. It checks the browser code and snapshot models, exports the self-contained page, and deploys it to GitHub Pages. The repository's Pages source is **GitHub Actions**.

To prepare the same output locally, run:

```sh
npm run check:site
npm run build:pages
```

The published artifact is `release/site/index.html`; it contains all runtime assets and works under the repository's URL prefix. No npm packages or backend are needed. Colleagues can open the URL directly without a GitHub account.

Deployment uses the committed `dist/` snapshots. After changing the prototype, commit and push to `main` to publish a new version. Refreshing project/session snapshots with `npm run snapshot` remains a local maintenance task because it reads the original IntelliJ session files and Java project. Generated releases and verification evidence are excluded from Git.

## Opening scene

Four tabs are open:

- **Project review · Claude Code** — an Air-hosted agent TUI transcript reviewing the project for quality issues. Expand tool output, search the transcript, and click finding references to open the corresponding source in the **before session** snapshot.
- **Secure channel controls with ADMIN role** — the actual Air graphical chat for `acp:eccab739`. Expand “Worked for 43s”, then any of its three chronological tool groups. Click command/search rows to inspect recorded output, the edited-file link or changed-file card for the diff, or the final response’s file link to open the turn diff. The visible follow-up is the recorded suggestion, displayed as a read-only draft.
- **NotificationController.java** — initially active, suspended on the breakpoint at **line 65**. Debug is visible with the request, injected Spring objects, security context and dispatcher watch.
- **Spring navigation** — controllers, services, repositories and injected test fields have native Spring autowiring gutter icons. Constructor parameters and `@Bean` factory dependencies link to their available declarations; `TemplateResolver`'s `MessageSource` opens the bundled Spring Boot factory source. Single targets open directly. Collections such as ChannelService's senders and the dispatcher's transformers open the compact **Choose Bean** list with keyboard selection. Spring usage icons return to production injection points. Click a `NotificationDispatcher` type reference to open its declaration.
- **Configuration properties** — all six `@Value` annotations have a native property gutter icon and clickable property key. These open the exact declaration in YAML or properties files. `notifyhub.default-channel` opens the production profile declaration; `notifyhub.rate-limit` offers the base and production definitions in **Choose Property**. Commented properties are excluded. Navigation uses the selected source snapshot, including the before-session version of SecurityConfig. Use **Alt Left** to return after navigating.

The **Threads & Variables** view matches the supplied debugger screenshots. The app is suspended at `NotificationController.java:65` on `http-nio-8080-exec-1`, with **126 hidden frames**. The complete 127-frame stack is captured from the paused JVM through a read-only thread dump; the filter button reveals it. Expand the **security context** (`TestUser`, `ROLE_ADMIN`), **this**, **notification**, and the **dispatcher** watch. Object identities match the running IDEA instance, including `NotificationController@21421`, `Notification@21420`, and `NotificationDispatcher@21423`. At this suspension point, `result` has not been assigned and is absent from Variables.

Browse notification fields, all five rule-map entries, channel senders and enablement flags, injected services, and the transformer registry. Spring objects expose **definition** and **context**, including **Declared in**, **scope**, **bean class name**, **definition type**, **Injected into**, **Depends on**, and **profiles**. **Navigate** opens the corresponding source. **Explore Elements** opens a collection inspector; **View** opens the complete notification value. The original five expression watches remain available through the arrow at the right of the evaluation row or **More debugger actions → Show saved watches**.

Click the inline `dispatcher` value or the `dispatcher` expression on line 65 to open IDEA's anchored, expandable value inspector. It works while either **Threads & Variables** or **Console** is active. The ADMIN security inlay and endpoint icon open the screenshot's security menu; **Navigate to Configuration** opens the `/api/notify` rule in `SecurityConfig.java`. Unlocking, evaluation, renderer creation, and execution controls are disabled in this read-only prototype.

`NotificationController.java` also shows the reference screenshot's yellow verified **logpoint** before line 67. Its inline **Log:** card displays `"Notification " + result.notificationId +` followed by `"dispatched: " + result.message`, with Java syntax colors and continuation markers. Click the yellow gutter marker, or use Enter/Space while it is focused, to collapse or reopen the card; that preference survives reloads. The expression is read-only presentation state. The original source, line numbers, breakpoint at line 65 and captured console log remain intact.

**Console** reproduces all 58 lines of the supplied application log, from the Java launch command and VM connection through the Spring Boot banner, database initialization, startup messages and final notification request. The launch command is folded as in IDEA; click it to expand or collapse the complete command and classpath. Timestamps, process ID, banner/log colors, logger links, multiline database details and blank lines are retained. The toolbar scrolls to the beginning/end and toggles soft wrapping. The adjacent Spring tabs browse the project's bean declarations, controller mappings, and relevant environment settings. Those supplementary tabs present source-derived metadata rather than a live actuator connection.

Resize Debug using its top divider, or resize the frames pane using its vertical divider. Both support dragging and arrow keys. Tree navigation supports arrow keys, Home, End, Enter, and Space; double-click a variable to expand or inspect it. Expansion, selected frame, layout, and saved-watch visibility survive reloads. **Show execution point** returns to line 65. Framework frames do not display fabricated local variables.

The **Mappings** tab reproduces IDEA's bordered **Path / Method** grid, compact rows, muted HTTP verbs, blue endpoint links, brown framework rows, Spring Web tab icon and vertical action toolbar. It includes all 16 mappings in the supplied reference: nine application endpoints, actuator and error handlers, and static resource patterns. Click an application path or handler to open its controller method. The Path header toggles sorting; refresh restores the captured table. The other sidebar actions are inactive. Framework rows are a screenshot snapshot, while application handlers and source locations come from the project files. The grid scrolls independently on smaller screens.

## Source and diffs

The main toolbar reproduces the running **NotifyHubApplication** debug configuration, its dropdown, green Resume, green Restart Debug and red Stop widgets, More Actions, Codex New Session, Search Everywhere, and the settings update dot. The configuration dropdown includes the selected configuration and its controls, **Current File**, and **Edit Configurations…**. Execution and session creation remain inactive in this browsing snapshot. The right rail keeps **Notifications**, **Database**, and **Maven** without opening content. These widgets use installed IDEA SVGs; their sources are recorded in `dist/icons/editor/sources.json` and refreshed with `scripts/export-editor-icons.py`.

The toolbar's **notify-hub** project dropdown reproduces New Project, Open, Clone Repository, IntelliJ IDEA Home and the selected Open Projects card with its path and branch. The **main** VCS dropdown includes action shortcuts, branch search and expandable Recent, Local, Remote and Tags groups. The saved branch and tag names come from the NotifyHub checkout; the demo branch folders and origin group match the references. Search filters actions and references; arrows, Enter and Escape support keyboard browsing. **Commit…** opens the existing Commit view. Other project and Git commands dismiss the menu in this read-only prototype without running operations.

The **New Session** dropdown in both the main toolbar and **Agent Sessions** tool window lists **Junie**, **Codex**, **Claude**, **OpenCode**, and **GitHub Copilot**, followed by a separator, **Cloud**, and **Manage Agents…**. It uses the installed Air agent icons, selected blue row and checkmark. Selecting an agent updates both selector icons and saves that shared preference; it creates no session. Cloud and Manage Agents dismiss the menu without opening anything. Arrow keys and Enter also select agents.

The top-right **IDE and Project Settings** menu includes **Automatic tour**. When enabled, it exposes **Loop playback** and **Playback speed** (0.5×, 1×, 1.5×, 2× or 3×). The default speed is **1.5×** the original pace and loop mode defaults to off. All three preferences are remembered in the browser. After five idle seconds, the tour opens and scrolls Claude’s findings, opens Codex, expands and collapses one inline tool preview, and shows the SecurityConfig partial diff. It then opens NotificationController through the debugger frame, explores the dispatcher and notification inline values, follows the Spring gutter to NotificationDispatcher, and clicks the injected default-channel property in the source to open its configuration declaration. Playback ends there, or repeats after a ten-second pause when loop mode is enabled. Speed adjusts pointer motion, scrolling and reading pauses; the idle and loop delays stay constant. A short blue callout appears beside the relevant control before each meaningful action, explaining its intent. Its reading pause follows the selected speed, and it disappears when the action begins or a visitor takes over. A moving pointer and blue click pulse show each interaction. Mouse movement, clicking, scrolling or typing hands control back to the visitor and ends that playback. In once-only mode, completion, interaction, resizing or returning to the tab never restarts playback automatically; turn the option off and on to replay. Changing loop mode or speed starts a fresh playback after settings closes. Menus, dialogs, searches and text selections postpone the initial start. Reduced-motion visitors start with autoplay off; they may enable it explicitly without animated pointer movement. Automatic browsing does not overwrite the saved visitor layout. Run `npm run verify:tour` for the focused browser walkthrough, including the exact scene order, speed, inline output, one-time and loop playback, interruption, narrow windows and the offline export.

In **Agent Sessions**, click **AI Usage** to toggle the inline **JetBrains Team** card. Its monthly bar, **90% left**, **till Dec 1**, native usage-details and refresh icons, Settings button, and selected footer control match the supplied reference. Enter/Space toggle the card; Escape from the widget closes it. The card adapts to narrow sidebar widths. Usage values are a static snapshot; account details and refresh controls are inactive.

Project and library files open directly below their editor tabs. There is no additional path/diff/search/read-only toolbar or per-file footer. Source search remains available through `⌘/Ctrl F`; diff access remains in the session, Project context menu and Commit tool window. Air session and diff toolbars retain their own native layouts.

The editor-tabs kebab menu matches the native Recent Files, Recent Locations, Go to File, tab closing/reopening, bookmarking and configuration entries, including shortcuts and separators. Its rows remain inactive; Escape, clicking outside, or clicking the kebab again dismisses it.

Java documentation comments render by default with IDEA-style green prose, inline code, JSON/preformatted examples, Params/Returns and a vertical rule. Click the gutter pencil or press **Control Option Q** while a comment is focused to toggle its original source. When the source editor is focused, the shortcut targets the first visible comment. Each comment retains its mode across reloads. Ordinary comments stay in source form. Original source line numbers are retained, so Spring targets, source links and the debugger breakpoint at line 65 still point to the captured source. Search operates on the visible representation.

Project supports expandable folders, filename/path search, file opening and source search. **Project selector → Project Snapshot…** switches between the session's resulting source and the cleaned baseline. Modified files expose **Show Diff** through their context menu or `⌘/Ctrl D`. The **Commit** tool window lists the project snapshot’s changes. The “Review Code” dropdown lets you choose the one-file session comparison or the whole working tree.

Clicking `SecurityConfig.java` in the session opens **SecurityConfig.java (Agent Turn)**. It reproduces Air’s recorded patch-fragment view: six Before Turn lines and eleven After Turn lines, relative line numbers, two difference groups, syntax and word highlights, curved connectors, and the blue snapshot banner. Both side-by-side and unified layouts are available. Split panes scroll horizontally independently; a fixed scrollbar remains available at the bottom.

**Open full diff** opens a separate complete-file comparison with the same layout selected. It compares HEAD with the working tree, uses actual source line numbers, and has no turn-snapshot banner. The full SecurityConfig comparison contains 69 before lines and 74 after lines. Turn and full tabs retain their individual layout and context settings.

The toolbar supports previous/next difference, clickable overview markers, context expansion/folding, changed-file selection, and **Go to Session**. The pencil opens the read-only after version in the source editor. Settings toggle word highlighting, line numbers and whitespace guides. Neither viewer offers editing or change-application actions.

Click any project Java type reference to open its declaration, including classes, interfaces, records, enums, nested types and test sources. Imports, package names and nested declarations resolve the target in the current source snapshot. Type links retain source syntax colors and underline on hover; rendered Javadoc type links work too. External types, strings and ordinary comments stay inactive. Use **Alt Left** to return to the previous file and scroll position. Run `npm run verify:source` for the declaration checks and browser walkthrough.

The imported Codex turn changes only `SecurityConfig.java` (**+7 −2**): method-specific ADMIN checks cover POST and PUT channel mutations; dashboard reads remain public. No test file was added in this session, and the recorded response states that tests were not run.

Both session and working-tree totals show **+7 −2** for `SecurityConfig.java`. The experimental `demo-test.sh` is excluded from project files, changes, file pickers and totals, including after snapshot refresh.

**Search Everywhere**, opened from the top-right search icon or `⌘/Ctrl P`, follows the native tab strip, blue search field, compact file rows and selected-path footer. **All** lists the selected project snapshot's files and filters by filename or path, without regard to case. Arrow keys select results; Enter or a click opens the file and focuses the source editor. Escape dismisses the dialog. The other categories, non-project items and split controls are inactive in this browsing prototype.

## Tool windows

**Agent Sessions** uses Air's compact toolbar and 28-pixel session rows. **Search Sessions** replaces the New Session/Add Folder row with a full-width, blue-focused search field and a separate **Close Search** button. Search filters the captured titles and prompts; Escape clears it and restores the toolbar. **Filter and View Options** opens a nested dropdown with **Filter Sessions**, **Show**, **Statuses**, **Sessions Visible**, and **Group By**. Options support pointer and keyboard browsing and survive reloads. Time labels such as **2d** use the recorded session timestamps; hovering shows the full date and time. **Show → Time** controls their visibility. Changed-file carets can expand the captured SecurityConfig change and open its session diff. Group headings can collapse and expand. The toolbar adapts to the pane's width.

The left rail uses the installed IDEA/Air icons in the screenshot order: **Commit**, **Project**, **Agent Sessions**, then **Structure** below the divider. Commit, Project and Agent Sessions share the upper dock. Structure opens independently beneath it. Resize either divider with the pointer or arrow keys; visibility, widths and expansion state survive reloads.

**Project** follows the supplied native Project pane: a 32-pixel header with New, Select Opened File, Expand Selected, Collapse All, Options and Hide; 22-pixel tree rows; 8-pixel indentation; the module's home-relative path; and focused blue / inactive grey selection. Java classes omit their extension. Folder, package, source/resource root, Spring class/factory, Maven, Docker, script and text icons are copied from the installed IDEA. The opening expansion and selection match the reference, with `SecurityConfig` visible and `NotifyHubApplication` selected independently of the editor. New remains disabled in this read-only prototype.

Type while the Project tree is focused to use **Speed Search**, or open it from Options. The kebab menu reproduces **Behavior**, **Appearance**, **Sort By**, **Edit Scopes…**, **Speed Search**, checked **Group Tabs**, **View Mode**, **Move to**, **Resize**, **Remove from Sidebar**, and **Help**. **Appearance → Show File Extensions** changes the class labels; **Group Tabs** remembers its checkmark. The Project selector provides **Project Snapshot… → Current version / Before session**. These controls do not occupy permanent rows. Right-click a modified file and choose **Show Diff**, or press `⌘/Ctrl D` while it is selected. **External Libraries** browses the same 19 cached Spring Boot source archives available in Logical Structure, including their packages and real class sources; it is a subset of the full IDEA dependency classpath. The Project selector also provides **Project Files**. Tree selection, expansion and display preferences survive reloads.

**Commit** replaces the former project-changes editor page. Its toolbar, checked Changes tree, selected file row, Amend controls, recorded commit message and Commit / Commit and Push buttons follow the supplied screenshot and the running IDEA instance. Selecting `SecurityConfig.java` opens **Commit: SecurityConfig.java**, with the HEAD hash and path on the left and a checked **Current version** on the right. Side-by-side/unified layouts, context folding, difference navigation and source opening remain available. File inclusion is local presentation state synchronized between the tree and diff. The commit message is read-only; commit, push, rollback, shelve, amend and message generation are disabled.

**Structure → Logical** displays the Spring Boot application tree: **Components (3)**, **Controllers (3)**, **Repositories (2)**, **Services (7)** and **Configurations (1)**. Browse controller endpoints, Autowires, Autowired In, component methods and SecurityConfig’s **Produced Beans**. Clicking source-bearing nodes opens the corresponding class, endpoint or bean method at its declaration. Expand using carets or arrow keys; the Structure menu provides search, expand all and collapse all. The tree keeps the application root while browsing, so navigating into a component does not discard the app overview. Physical Structure is omitted.

**Auto Configurations** contains the 19 Spring Boot 4.0.2 source JAR groups observed in IDEA. The 121 candidate classes and their read-only sources are copied from the local Maven cache; they are dependency metadata, not a runtime activation report. These library sources have their own editor tabs with find and rendered Javadoc and do not count as project files or changes.

Shortcuts: `⌘/Ctrl P` searches files, `⌘/Ctrl F` searches the open source/transcript, `⌘/Ctrl 0` toggles Commit, `⌘/Ctrl 1` toggles Project, `⌘/Ctrl 2` toggles Agent Sessions, `⌘/Ctrl 7` toggles Structure, `⌘/Ctrl 5` toggles Debug, `⌘/Ctrl W` closes a tab, `⌥ ←` follows source-navigation history, and `Esc` dismisses search/dialogs. The project, logical and debugger trees and resizers support keyboard interaction. In the help dialog, **Restore the opening scene** resets this browser's saved layout and tabs.

## Provenance

The project baseline is read from:

```text
/Users/anton/IdeaProjects/screencasts/air-demo/notify-hub
```

The prototype has 60 baseline files and 60 resulting files. It excludes the experimental `demo-test.sh`, generated outputs, IDE internals and Git metadata. The real checkout is never modified.

Codex content comes from all 297 ACP events in:

```text
/Users/anton/Library/Caches/JetBrains/IntelliJIdea2026.3/acp/projects/bd20dbf4/threads/acp%3Aeccab739/events.jsonl
```

`scripts/import_session.py` assembles streamed messages and tool updates in their recorded order. It reconstructs the complete SecurityConfig before version from the recorded terminal read and applies the recorded patch as data to obtain the after version. Export verifies that the after version matches the current checkout. The importer never executes transcript commands. Tool rows expand directly in the transcript into bordered command/output cards, with monospaced syntax colors, a limited-height preview and Show more/Show less. The output menu can copy the recorded text. Expansion is preserved when switching tabs and reloading. The report-problem flag remains visible but inactive, and is never part of the tour. Raw session events have no UI view or navigation entry and are excluded from the tour. Previously saved event tabs are discarded when loading a visitor’s layout. File reads without captured contents show that limitation inline.

The Claude review remains an **authored scenario fixture**. The debugger reconstructs the supplied screenshots and the running IDEA suspension captured on 22 November 2026; its object IDs, visible fields, security context, bean definitions and console were inspected directly. Deeper collection/service details and supplementary Spring views are reconstructed from project sources where the captured UI was collapsed. This prototype has no live agent or debugging connection. The previous historical `acp:9ab14ec6` session and the earlier scripted Codex transcript are superseded.

The shell uses the installed IntelliJ IDEA 2026.3. The Codex chat follows the four supplied Air screenshots: selected blue session tab, centered transcript, right-aligned prompt, collapsible work and tool groups, compact changed-file card, response actions, static suggested follow-up, and Auto review footer. Claude is embedded in the Air agent editor, with its TUI transcript starting directly beneath the editor tabs. It has no project/branch, agent-mode or search toolbar above the terminal content. Transcript search remains available on demand through ⌘/Ctrl F. Its inner view uses Claude Code TUI formatting; it is not the IntelliJ Terminal tool window. Codex keeps the graphical chat interface. The Claude version label matches the installed CLI's `2.1.330`; its review content is authored. The local JetBrains Mono font, agent SVG icons, tool-window icons and Spring tree icons are copied from the installed IDE for this local prototype; copied SVG files retain their original copyright notices. Browser rendering is an interactive recreation, not a native IDE component.

`scripts/export-data.py` combines the real Codex record with the current project snapshot, authored Claude review and `scripts/debugger_snapshot.py`, then writes `dist/data.json`. The old `fixtures/dashboard-security/` files are retained only as historical material and are not included in the current snapshot. `scripts/export-logical-libraries.py` separately snapshots the cached auto-configuration source JARs into `dist/logical-libraries.json`. No external assets, libraries or APIs are loaded at runtime.

## Refresh and verify

The focused AI Usage walkthrough is in `evidence/ai-usage-v11/2026-11-22T1812Z/`. It passed 15 browser checks covering the card, keyboard controls, session browsing, native icons and sidebar resizing, with no browser runtime errors. The final card and surrounding desktop were visually reviewed; `npm run check` also passed.

The full-startup-console update is verified in `evidence/console-v12/2026-11-22T1819Z/`. All 40 debugger browser checks passed, including an exact text comparison with the supplied log after expanding the Java command, scrolling to both ends and soft wrapping. Startup, final-request and laptop screenshots were visually reviewed. The debugger height also stays within the viewport when the browser shrinks.

```sh
npm run snapshot
npm run check
node scripts/verify-editor-browser.mjs
```

Reload after refreshing. Snapshot generation verifies that the requested line 65 still contains the dispatch call. `npm run check` checks JavaScript syntax, exact current-source fidelity, message and raw-event fidelity, the recorded patch, session versus working tree totals, complete before/after comparisons, debugger consistency, source-derived Spring targets in both project snapshots, Claude finding references, logical component counts, endpoint/method source positions, bean relationships, cached auto-configuration metadata and the legacy changes-tab migration. It does not execute Java tests or start the real app.

The latest toolbar and rendered-comment walkthrough is in `evidence/editor-v8/`, with a separate timestamped directory per run. It covers the configuration dropdown, inert right rail, clean source editors, rendered/source toggling, keyboard shortcut, persistence, search, original line numbers, the captured breakpoint and inspector, and session partial/full diff navigation at desktop and laptop sizes. `node scripts/verify-debugger-browser.mjs` and `node scripts/verify-project-browser.mjs` also passed their 36 and 28 regression checks after these changes.

The current tool-window screenshots, native inspection records and verification reports are under `evidence/tool-windows-v5/`. The prior diff screenshots and verification reports are under `evidence/air-diff-v4/`. The latest run passed 21 browser checks with no browser warnings or errors. Checks cover the partial and complete comparisons, both layouts, source/session navigation, diff settings, context folding, horizontal scrolling, snapshot fidelity, and exclusion of the experimental script. Desktop, wide and phone layouts were visually reviewed. The earlier chat verification is under `evidence/air-chat-v3/`. Browser checks use a named `?workspace=...`, which keeps their layout changes separate from the delivered scene.

Debugger reference captures, native accessibility trees and browser verification are under `evidence/debugger-v6/`. The latest focused walkthrough passed all 36 browser checks with no runtime errors, including inline inspectors, nested values, all 127 stack frames, console contents, security navigation, resizing and layout persistence. Desktop, laptop and narrow layouts were visually reviewed. Run `node scripts/verify-debugger-browser.mjs` using the installed Playwright CLI.

Project reference captures, visual comparisons and browser verification are under `evidence/project-v7/`. All 28 Project browsing checks pass, with no runtime errors or missing icon requests. Desktop, laptop and narrow layouts were visually reviewed. Run `node scripts/verify-project-browser.mjs` for its browsing walkthrough. `python3 scripts/export-project-icons.py` refreshes the 40 Project-specific assets from the installed IDEA; `dist/icons/project/sources.json` records their original archive paths. `dist/project-view.js` and `dist/project-view.css` implement this pane.

Implementation: `dist/debugger.js` and `dist/debugger.css` implement the captured debugger and inline inspectors; `dist/app.js` contains the browser shell, `dist/diff.js` and `dist/diff.css` implement the Air comparison viewers, `dist/tool-windows.js` and `dist/tool-windows.css` implement the Commit and Logical docks, and `dist/scenario.js` / `dist/scenario.css` contain the two session renderers and Spring source navigation.
