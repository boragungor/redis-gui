/**
 * A safe wrapper around fetch that handles non-JSON responses gracefully.
 * Returns { success: false, error: message } if the response is not valid JSON.
 */
export async function safeFetch<T = Record<string, unknown>>(
  url: string,
  options: RequestInit
): Promise<T & { success: boolean; error?: string }> {
  try {
    const res = await fetch(url, options)

    let data: T & { success: boolean; error?: string }
    try {
      data = await res.json()
    } catch {
      return {
        success: false,
        error:
          "Server returned an invalid response. If running in the v0 preview, download the project and run locally to connect to Redis.",
      } as T & { success: boolean; error: string }
    }

    return data
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network request failed",
    } as T & { success: boolean; error: string }
  }
}
