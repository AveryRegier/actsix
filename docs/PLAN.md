Summary of Deacon Care System Plan

**Overview**
System needed for deacons to track and support church members in need
Deacons must record calls, needs, and outcomes for assigned members
Monthly meetings to review and validate all members have been contacted
System should be web-based, low-cost (under $10/month), and accessible via phone/computer
AWS Lambda, S3, and sengo proposed for backend; social login for access
Features include: member/household organization, need tracking, contact info, note-taking, and easy
member management
Goal: Efficient, secure, and affordable care tracking for church deacons
System Purpose and User Group
System supports deacons making calls to church members in need.
Tracks member well-being, prayer requests, and physical needs.

**Deacon Workflow and Data Recording Needs**
Deacons record member calls, including member identity, needs, conversation details, date, and time.
Each deacon manages a subset of members for regular contact.
Monthly meetings require review and validation that all members have been contacted.

**Monthly Review and Validation Process**
Capture member needs and discussion notes monthly.
Organize data by household (e.g., couples, widowed individuals).

**Member Data Structure and Searchability**
Organize household documents by last name for searchability.
Record household members' names, addresses, and phone numbers.
Identify specific needs (e.g., cancer, long-term care, shut-in).
Maintain multiple contact methods for each household.

**Member Management and Status Tracking**
Occasional addition and removal of members required.
Members removed due to lack of needs, death, relocation, or family support.
Need to capture and summarize each event for every member.
Current status and needs of each member must be quickly viewable in a living document.

**System Requirements: Online, Secure, Accessible**
App must be online and accessible via phone or computer.
Deacons require access to the app each month.
Login mechanism recommended for security; social login suggested as an option.

**Deacon User Experience and Quick Access**
Each deacon can view the full member list.
Deacons can add information to any member's profile.
Deacons have a quick list of assigned or recently interacted members for easy access.

**Technical Implementation and Cost Goals**
System designed to be web-based and low-cost.
Uses AWS Lambda for backend operations.
Stores data in AWS S3 via sengo library (Node.js client alternative to MongoDB).
sengo enables document searchability in S3.
Target operational cost: less than $10/month.

**System Availability and Final Notes**
Solution provides on-demand availability for deacons.
Supports monthly group meetings with concurrent usage.
Tracks and manages changes without data loss.
Remains inactive 99% of the time when not in use.