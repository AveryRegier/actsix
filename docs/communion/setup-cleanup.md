# Intro
Communion also needs setup and cleanup teams associated with each day that we have communion.

We need deacons to be able to sign up for these positions.

Setup begins 1 hour before the first service time on that day.  
Cleanup is after each service and involves pickng up cups from the pews, cleaning up the trays, and putting everything away after the final service.

We need 2 people for preparation plus a trainee.
We need 3 people for cleanup.

Anyone that signs up for distribution shoulld also be able to sign up for preparation or cleanup.
Some who do preparation are not physically able to do cleanup or distribution.

# Design requirements.
There shouldn't need to be added code to handle this.  Thse should be able to he handled with new event types.  If they can't, we need to extend the event types to handle the situation.

Having a single preparation event is a requirement for adding a Lord's Supper distribution event on a given day.  If there is already a prepration event scheduled on that day do not schedule a new one. A cleanup event must be added for 1 hour after each Lord's Supper distribution event.  So the event types must be able to refer to other event types so that those prerequisites can be setup.  The expectation is that the distribution events will be setup and the preparation and cleanup events will be added automatically.

When a distribution event is setup, we should be able  to specify multiple times on that one setup page, so that we do not get confused when setting up the prepration and cleanup events if they were setup one at a time.

Each day we setup for Lord's supper we need a leader and an optional assistant.  The leader will be assigned by the person who creates the event.  The assistant can be signed up for via the app.  If the leader cannot serve they can be replaced by the leader, or the lead deacon or an admin or a person with the 'staff' role.  Any of these can also assign any 'deacon', 'elder', or 'usher' to any position in case they do not use the app.