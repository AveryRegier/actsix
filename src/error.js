
// mapping from status code to name
const statusCodeNames = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

export class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = statusCodeNames[statusCode] || 'ApiError';
    this.statusCode = statusCode;
  }
}

export function handleApiError(c, error) {
  if (error instanceof ApiError) {
    console.error(`API Error: ${error.name} - ${error.message}`);
    return c.json({ error: error.name, message: error.message }, error.statusCode);
  } else {
    console.error('Unexpected Error:', error);
    return c.json({ error: 'Internal Server Error', message: 'An unexpected error occurred.' }, 500);
  }
}
