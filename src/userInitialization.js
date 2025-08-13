const { db } = require('./sengoClient');
const { logger } = require("./logger.js");
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

exports.handler = async (event) => {
  logger.info({event}, 'Cognito PreSignUp Trigger Event');

  const email = event.request.userAttributes.email;
  const phoneNumber = event.request.userAttributes.phone_number;

  try {
    // Search for member by email
    let member = await db.findOne('members', { email });

    if (member) {
      // Add phone number to the member record if not already present
      if (!member.phoneNumbers.includes(phoneNumber)) {
        member.phoneNumbers.push(phoneNumber);
        await db.update('members', member.id, member);
      }

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

    // Search for member by phone number
    member = await db.findOne('members', { phoneNumbers: phoneNumber });

    if (member) {
      // Add email to the member record if not already present
      if (!member.email) {
        member.email = email;
        await db.update('members', member.id, member);
      }

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
    logger.info({event}, 'Cognito PreSignUp Trigger Event Response');
  }
};
