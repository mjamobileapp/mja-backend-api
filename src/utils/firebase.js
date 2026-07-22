const { google } = require("googleapis");

const FIREBASE_MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let authClientPromise;

const getFirebaseConfig = (environment = process.env) => {
  const projectId = String(environment.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(environment.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(environment.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
};

const getAuthClient = (config) => {
  if (!authClientPromise) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey,
      },
      scopes: [FIREBASE_MESSAGING_SCOPE],
    });
    authClientPromise = auth.getClient();
  }
  return authClientPromise;
};

const sendPushNotification = async ({ token, title, body, data = {} }) => {
  const config = getFirebaseConfig();
  if (!config || !token) return false;

  const client = await getAuthClient(config);
  await client.request({
    url: `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`,
    method: "POST",
    data: {
      message: {
        token,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ),
      },
    },
  });

  return true;
};

module.exports = { sendPushNotification };
