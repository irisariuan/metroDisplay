<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
Do not use browser for checking unless user has explicitly asked for it. If you are unsure, ask the user for clarification.
Try to reason from the code.
This is using a newer version of Next.js/React, DO NOT apply what you know about older versions of Next.js/React. If you are unsure, ask the user for clarification.
Follow about React hooks rules.
If an element is or will be reused, extract it into a separate React component.