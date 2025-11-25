/**
 * Environment Variable Validation
 * Validates all required environment variables at startup
 */

const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const envVarDescriptions = {
  VITE_FIREBASE_API_KEY: 'Firebase API Key for authentication',
  VITE_FIREBASE_AUTH_DOMAIN: 'Firebase Auth Domain (e.g., your-app.firebaseapp.com)',
  VITE_FIREBASE_PROJECT_ID: 'Firebase Project ID',
  VITE_FIREBASE_STORAGE_BUCKET: 'Firebase Storage Bucket',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'Firebase Messaging Sender ID',
  VITE_FIREBASE_APP_ID: 'Firebase App ID',
};

/**
 * Validates all required environment variables
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateEnvVars() {
  const errors = [];
  const warnings = [];

  // Check for required variables
  requiredEnvVars.forEach(varName => {
    const value = import.meta.env[varName];

    if (!value) {
      errors.push(`Missing required environment variable: ${varName}`);
    } else if (value.includes('...') || value.includes('your_') || value.includes('YOUR_')) {
      errors.push(
        `Environment variable ${varName} appears to be a placeholder. Please set a real value.`
      );
    } else if (varName === 'VITE_FIREBASE_API_KEY' && value.length < 20) {
      errors.push(`Environment variable ${varName} is too short. Please check your .env file.`);
    } else if (varName === 'VITE_FIREBASE_PROJECT_ID' && value === 'default-app-id') {
      warnings.push(
        `Using default project ID. Please set VITE_FIREBASE_PROJECT_ID in your .env file.`
      );
    }
  });

  // Validate format of specific variables
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  if (authDomain && !authDomain.includes('.firebaseapp.com') && !authDomain.includes('localhost')) {
    warnings.push(`VITE_FIREBASE_AUTH_DOMAIN format looks unusual: ${authDomain}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Gets a validated environment variable or throws an error
 * @param {string} varName - Name of the environment variable
 * @returns {string} The environment variable value
 * @throws {Error} If the variable is missing or invalid
 */
export function getEnvVar(varName) {
  const value = import.meta.env[varName];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${varName}\n\n${envVarDescriptions[varName] || 'Please set this in your .env file.'}`
    );
  }

  if (value.includes('...') || value.includes('your_') || value.includes('YOUR_')) {
    throw new Error(
      `Environment variable ${varName} appears to be a placeholder. Please set a real value.`
    );
  }

  return value;
}

/**
 * Displays environment variable errors in a user-friendly way
 */
export function displayEnvErrors(validation) {
  if (!validation.isValid) {
    console.error('❌ Environment Variable Validation Failed:');
    validation.errors.forEach(error => {
      console.error(`   - ${error}`);
    });

    if (validation.warnings.length > 0) {
      console.warn('⚠️  Warnings:');
      validation.warnings.forEach(warning => {
        console.warn(`   - ${warning}`);
      });
    }

    return true; // Has errors
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Environment Variable Warnings:');
    validation.warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
  }

  return false; // No errors
}
