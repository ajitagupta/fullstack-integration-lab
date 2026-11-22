import { request } from "./client";
import { ApiError, InvalidResponseError, NetworkError, RequestCancelledError } from "./api-error";

// A minimal stand-in for a fetch Response: only what client.ts uses
function fakeResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError("not JSON");
      return body;
    },
  } as Response;
}

// A fetch that never answers, but rejects as soon as it's aborted, like the real one
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
  );
}

// Awaits a promise that must fail, and returns the error, typed
async function failure<E>(promise: Promise<unknown>): Promise<E> {
  try {
    await promise;
  } catch (e) {
    return e as E;
  }
  throw new Error("Expected the request to fail, but it succeeded");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("returns the JSON body of a successful response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(200, { total: 3 })));
  await expect(request("/workouts")).resolves.toEqual({ total: 3 });
});

test("turns an error response into an ApiError with the server's errors", async () => {
  const errors = [{ field: "distance_km", error: "The key distance_km is missing." }];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(400, { errors })));

  const err = await failure<ApiError>(request("/workouts"));
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(400);
  expect(err.errors).toEqual(errors);
  expect(err.message).toBe("The key distance_km is missing.");                 // the first error's text
});

test("an error response without JSON still becomes an ApiError", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(502)));
  const err = await failure<ApiError>(request("/workouts"));
  expect(err).toBeInstanceOf(ApiError);
  expect(err.message).toBe("Request failed with status 502");
});

test("204 No Content returns null", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(204)));
  await expect(request("/workouts/1", { method: "DELETE" })).resolves.toBe(null);
});

test("a 200 that isn't JSON is an InvalidResponseError", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(200)));
  await expect(request("/workouts")).rejects.toBeInstanceOf(InvalidResponseError);
});

test("no connection at all is a NetworkError", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await failure<NetworkError>(request("/workouts"));
  expect(err).toBeInstanceOf(NetworkError);
  expect(err.message).toBe("Can't reach the server.");
});

test("after 10 seconds without an answer, it gives up with a NetworkError", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", hangingFetch());

  const result = expect(request("/workouts")).rejects.toThrow("Server is taking too long to respond.");
  await vi.advanceTimersByTimeAsync(10000);       // milliseconds until the client's timeout fires
  await result;
});

test("a request cancelled by the caller is a RequestCancelledError, not a NetworkError", async () => {
  vi.stubGlobal("fetch", hangingFetch());
  const controller = new AbortController();

  const result = expect(request("/workouts", { signal: controller.signal })).rejects.toBeInstanceOf(RequestCancelledError);
  controller.abort();
  await result;
});