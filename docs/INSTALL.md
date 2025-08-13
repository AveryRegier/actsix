# Installation Guide for ActSix

This guide provides step-by-step instructions to set up ActSix on a new AWS account, including enabling Google and Facebook login providers for Cognito.

---

## **1. Prerequisites**
- An AWS account.
- AWS CLI installed and configured.
- Node.js and npm installed.
- Google Cloud Console and Facebook Developer accounts for enabling login providers.

---

## **2. Deploying ActSix to AWS**

### **Step 1: Clone the Repository**
```bash
git clone https://github.com/<your-repo>/actsix.git
cd actsix
```

### **Step 2: Install Dependencies**
```bash
npm install
```

### **Step 3: Build the Project**
```bash
npm run build
```

### **Step 4: Deploy the CloudFormation Stack**
1. Package the Lambda function:
   ```bash
   npm run package
   ```
2. Deploy the stack:
   ```bash
   aws cloudformation deploy \
       --template-file cloudformation.yaml \
       --stack-name actsix-deacon-care-system \
       --capabilities CAPABILITY_NAMED_IAM
   ```

---

## **3. Enabling Google Login Provider**

### **Step 1: Create a Google API Project**
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Create an **OAuth 2.0 Client ID**:
   - Application type: Web application.
   - Authorized redirect URIs: `https://<your-cognito-domain>/oauth2/idpresponse`.

### **Step 2: Add Google to Cognito**
1. Copy the **Client ID** and **Client Secret** from Google.
2. Go to the Cognito Console.
3. Select your user pool.
4. Navigate to **Federation > Identity providers**.
5. Select **Google** and enter the Client ID and Secret.

---

## **4. Enabling Facebook Login Provider**

### **Step 1: Create a Facebook App**
1. Go to the [Facebook Developers Console](https://developers.facebook.com/).
2. Create a new app.
3. Navigate to **Settings > Basic** and add your app's details.
4. Under **Add a Product**, select **Facebook Login** and configure it:
   - Valid OAuth Redirect URIs: `https://<your-cognito-domain>/oauth2/idpresponse`.

### **Step 2: Add Facebook to Cognito**
1. Copy the **App ID** and **App Secret** from Facebook.
2. Go to the Cognito Console.
3. Select your user pool.
4. Navigate to **Federation > Identity providers**.
5. Select **Facebook** and enter the App ID and Secret.

---

## **5. Finalizing Cognito Setup**

### **Step 1: Update the App Client**
1. Go to the Cognito Console.
2. Select your user pool.
3. Navigate to **App clients**.
4. Edit the app client settings and enable **Google** and **Facebook** as identity providers.

### **Step 2: Test the Login Providers**
1. Use the Cognito-hosted UI to test Google and Facebook logins.
2. Verify that users are created in the Cognito user pool.

---

## **6. Additional Configuration**

### **Environment Variables**
Ensure the following environment variables are set for the Lambda function:
- `AWS_REGION`
- `COGNITO_CLIENT_ID`
- `API_GATEWAY_URL`

These are automatically configured via the CloudFormation template.

---

## **7. Testing the Application**
1. Access the API Gateway URL from the CloudFormation outputs.
2. Test the endpoints and ensure the application is functioning as expected.

---

For further assistance, refer to the project documentation or contact the development team.
