/**
 * Firestore utility functions
 * Extracted from App.jsx for reuse
 */

let db = null;
let appId = null;

export const setFirestoreInstance = (firestoreDb, projectId) => {
  db = firestoreDb;
  appId = projectId;
};

// Helper function to save image URL to Firestore
export const saveImageToFirestore = async (type, identifier, imageUrl) => {
  if (!db || !appId) return;

  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const imageRef = doc(db, 'artifacts', appId, 'public', 'data', 'images', type, identifier);
    await setDoc(imageRef, { url: imageUrl, savedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    // Silently fail - image caching is not critical
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`Failed to save image to Firestore:`, error);
    }
  }
};

// Helper function to get image URL from Firestore
export const getImageFromFirestore = async (type, identifier) => {
  if (!db || !appId) return null;

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const imageRef = doc(db, 'artifacts', appId, 'public', 'data', 'images', type, identifier);
    const imageDoc = await getDoc(imageRef);
    if (imageDoc.exists()) {
      return imageDoc.data().url;
    }
  } catch (error) {
    // Silently fail - image lookup is not critical
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`Failed to get image from Firestore:`, error);
    }
  }
  return null;
};
