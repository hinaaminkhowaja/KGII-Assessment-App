# KG II Assessment App — Apps Script connected build

React + TypeScript + Vite frontend connected to the configured Google Apps Script web app.

## Features
- Dashboard records, reference geography, user accounts and access assignments loaded through Apps Script API actions.
- Email-only dashboard login; passwords are not stored in the frontend.
- Dashboard data requests are made using the signed-in email; server-side access rules should be enforced by Apps Script.
- Student survey responses are submitted to `APP_Student_Surveys` through the `studentsurvey` API action.
- Teacher pre/post rubric responses are submitted to `APP_Teacher_Surveys` through the `teachersurvey` API action.
- Admin approvals and geography access assignments are sent to the `updateuser` and `saveaccess` API actions.
- Survey drafts are stored in sessionStorage only; submitted surveys are sent to the backend, not stored as local submission records.

## Run locally
```bash
npm install
npm run dev
```

## API
The frontend is configured to use the Apps Script deployment URL agreed for this project. Ensure the deployed Apps Script has the `reference`, `login`, `dashboard`, `users`, and `access` GET actions and the `studentsurvey`, `teachersurvey`, `updateuser`, and `saveaccess` POST actions enabled.
