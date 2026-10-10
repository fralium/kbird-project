export const isDevelopment = process.env.NODE_ENV === 'development';

export const devLog = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

export const devError = (...args) => {
  if (isDevelopment) {
    console.error(...args);
  }
};
