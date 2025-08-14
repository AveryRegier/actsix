const { db } = require('./sengoClient');
const { logger } = require("./logger.js");
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
  logger.info({event}, 'Cognito Trigger Event');

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
        await cognito.adminAddUserToGroup({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          GroupName: 'deacon',
        }).promise();
      } else if (tags.includes('staff')) {
        await cognito.adminAddUserToGroup({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          GroupName: 'staff',
        }).promise();
      }

      // Set the custom:member_id attribute
      event.response.autoConfirmUser = true;
      event.request.userAttributes['custom:member_id'] = member.id;
      return event;
    }

    // If no member is found, do not confirm the user
    event.response.autoConfirmUser = false;
    return event;
  } catch (error) {
    logger.error(error, 'Error during user initialization:');
    throw error;
  } finally {
    logger.info({event}, 'Cognito Trigger Event Response');
  }
};
