import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDkT5cIr_mWrGPrGneas9MvYN_-81Azvtw",
  authDomain: "game-90c96.firebaseapp.com",
  databaseURL: "https://game-90c96-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "game-90c96",
  storageBucket: "game-90c96.firebasestorage.app",
  messagingSenderId: "85239291928",
  appId: "1:85239291928:web:bb1ae8360fd687ad35236d",
  measurementId: "G-P9KV92QCTT"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);