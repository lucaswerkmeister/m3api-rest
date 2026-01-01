# Changelog

This file records the changes in each m3api-rest release.

The annotated tag (and GitLab release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

## next (not yet released)

No changes yet.

## v0.1.0 (2026-01-01)

Initial release, including:

- `getJson()` and `postForJson()` functions,
  for making GET and POST requests returning JSON data.
- ``` path`` ``` template literal tag function,
  for encoding request paths.
- `getResponseStatus()` function,
  for getting the HTTP status code of a response.
- `RestApiServerError`, `RestApiClientError`,
  `UnexpectedResponseStatus`, `InvalidResponseBody`,
  and `UnknownResponseError` error classes thrown by these functions.
