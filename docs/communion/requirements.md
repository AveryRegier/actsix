# Communion helper tracking

Grace church serves communion during service once a month on a scheduled Sunday.  Usually we have 2 services, but occasonally it is
held on a single service Sunday.

We need to know who is going to be available to serve communion and 
be able to assign them to a position so that it is clear who will serve where.

We typically need 22 people each service.  Some people will serve both services but most serve in whichever they normally go to.  Elders can help if we don't have enough deacons. We can also get additional men 
from the membership to help who are there, but we need to know who
is available that day first.

## Design

### Setup
We need to be able to schedule communion, usually a month or two out.  we would schedule by date and service start time.  By default if the date is a Sunday then the times would be 8:30 AM and 10 AM. If it is not a Sunday then the default time would be 7PM.

### Sign up
Deacons should be able to use the app to mark when they expect to be available.  The app could show a current count of for each date right on that screen.  It should be as simple as just clicking on the request on the home screen to mark their availablility and the count would go up or down immediately.  They should also be able to mark themselves as unavailable.

Deacons would see a Sign Up section in the header and menu following 
the existing responsive design patterns. 

The color coding is red for 18 or fewer, yellow for 21 or fewer, and 
green for 22 or more.

We could automatically assign the person to a place and tell them 
where they are assigned.

### Assignments

The auditorium is setup with

N = North
S = South
F = Front
B = Back
C = Center
W = Wall
| = volunteer

| SFW | SF || SFC || NFC || NF | NFW |
| SBW | SB || SBC || NBC || NB | NBW |

We would prioritize the front and center and work our way out and back
when assigning available people.

We could have a page we link to that shows everyone and their sign up locations.  It should call out open positions needed to be filled.
it should be printable. This page would be available to staff and deacons.

### Non-deacon sign ups
We will add an 'usher' role that can login, and will see the sign up page, but that is it.  Staff, and elders should also be able to sign up
for communion.  Usher's should see the sign up page as their home screen.

It should be easy to add an Usher, We just need their name and email address.

### Notification
The day before communion, signed up members should get an email with a
reminder and telling they what their position is.

If there are not enough sign ups, deacons, elders, and ushers (not staff) should get an email asking if they would be available with a link back to the sign up page.

## Technical design
The part of the page that handles this form should be in its own page and included dynamically when the home page is generated.

Communion will be called "Lord's Supper" everywhere in the app. 
It wil have its own section of the API.

Sengo should have 'calendar', 'event', and 'sign-up' documents to track the data.
Events should represent event definitions (type + positions), not specific dates.
Calendar entries should be date/time focused instances that point to an event definition.
Sign-up entries should point to the calendar instance and a specific position in the related event definition.
Sign-up documents should be queryable by memberId and eventId, and also by calendarId for per-service lookups.