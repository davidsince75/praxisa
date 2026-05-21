# Praxisa Demo Test Checklist

## Admin Portal

- [ ] Login with admin credentials → redirects to dashboard
- [ ] Create a new user (student role)
- [ ] Create a new course, add a lesson, publish it
- [ ] View analytics dashboard (charts render)
- [ ] Create a campaign (draft), then send it
- [ ] View audit log (events appear for actions taken)
- [ ] View GDPR DSR queue
- [ ] Use AI draft generator
- [ ] Logout → redirects to /login

## Teacher Portal

- [ ] Login with instructor credentials → redirects to /teacher/courses
- [ ] View course list, open a course
- [ ] Open course builder, add/edit a lesson
- [ ] Open grading page, grade a submission
- [ ] View teacher analytics
- [ ] Use AI ingest (paste lesson text, submit)
- [ ] View messages inbox
- [ ] Notification bell shows unread count when a message arrives
- [ ] View course ratings tab (Évaluations)
- [ ] Logout → redirects to /login

## Learner Portal

- [ ] Login with student credentials → redirects to /learn/catalog
- [ ] Browse catalog, enrol in a course
- [ ] Open course player, complete a lesson
- [ ] Take a quiz
- [ ] View progress page (chart renders)
- [ ] Open AI chat, ask a question about a lesson
- [ ] View messages, send a reply
- [ ] Notification bell shows unread count when teacher grades work
- [ ] Complete all lessons → certificate page renders with name and course title
- [ ] Rate the completed course (stars + comment)
- [ ] Logout → redirects to /login

## Cross-cutting

- [ ] All three portals: unauthenticated access redirects to /login
- [ ] Admin cannot access /teacher/\* (redirects)
- [ ] Student cannot access /teacher/\* (redirects)
- [ ] Notifications mark-as-read works (badge clears)
- [ ] Print certificate (browser print dialog opens)
