const firebaseConfig = {
  apiKey: "AIzaSyBWraRTJ_7lQkZQFOr-p1GhkONjnPEHqW0",
  authDomain: "accounttree.firebaseapp.com",
  databaseURL: "https://accounttree-default-rtdb.firebaseio.com",
  projectId: "accounttree",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
