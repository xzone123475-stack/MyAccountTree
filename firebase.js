const firebaseConfig = {
  apiKey: "AIzaSyACilghlkINXVVVR2BntW34gNccEl0SivY",
  authDomain: "myaccounttree.firebaseapp.com",
  databaseURL: "https://myaccounttree-default-rtdb.firebaseio.com",
  projectId: "myaccounttree",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();