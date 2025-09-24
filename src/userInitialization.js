const { db } = require('./sengoClient');
const { logger } = require("./logger.js");
const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  logger.info('Cognito Trigger Event', {event});

  const email = event.request.userAttributes?.email;
  const phoneNumber = event.request.userAttributes?.phone_number;

  if (!email && !phoneNumber) {
    logger.warn('No email or phone number provided.');
    event.response.autoConfirmUser = false;
    return event;
  }

  try {
    // Search for member by email or phone number
    let member = email ? await db.findOne('members', { email }) : null;

    if (!member && phoneNumber) {
      member = await db.findOne('members', { phoneNumbers: phoneNumber });
    }

    if (member) {
      // Update member record with missing attributes
      if (email && !member.email) {
        member.email = email;
      }
      if (phoneNumber && !member.phoneNumbers.includes(phoneNumber)) {
        member.phoneNumbers.push(phoneNumber);
      }
      await db.update('members', member.id, member);

      // Add the user to the correct Cognito group based on tags
      const tags = member.tags || [];
      if (tags.includes('deacon')) {
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          GroupName: 'deacon',
        }));
      } else if (tags.includes('staff')) {
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          GroupName: 'staff',
        }));
      }

      // Set the custom:member_id attribute
      event.response.autoConfirmUser = true;
      event.request.userAttributes['custom:member_id'] = member._id;
      return event;
    }

    // If no member is found, do not confirm the user
    event.response.autoConfirmUser = false;
    return event;
  } catch (error) {
    logger.error('Error during user initialization:', error);
    throw error;
  } finally {
    logger.info('Cognito Trigger Event Response', {event});
  }
};
