/**
 * Utility functions for safe API calls and JSON parsing
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely parse JSON response with proper error handling
 */
export async function safeJsonResponse<T = unknown>(response: Response): Promise<ApiResponse<T>> {
  try {
    // Check if response is ok
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`
      };
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error: 'Server returned non-JSON response. This usually means you were redirected to a login page or error page.'
      };
    }

    // Parse JSON
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse response'
    };
  }
}

/**
 * Make a safe API call with automatic JSON parsing and error handling
 */
export async function safeApiCall<T = unknown>(
  url: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    return await safeJsonResponse<T>(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Check if user is authenticated by making a test API call
 */
export async function checkAuthStatus(): Promise<boolean> {
  const result = await safeApiCall('/api/auth/me');
  return result.success && !!(result.data as { user?: unknown })?.user;
}