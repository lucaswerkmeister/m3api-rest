# Changelog

This file records the changes in each m3api-rest release.

The annotated tag (and GitLab release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

## v0.2.0 (2026-04-05)

- Major functionality update:
  beyond `getJson()` and `postForJson()`,
  m3api-rest now supports the following:
    - request methods:
      - GET
      - POST
      - PUT
      - DELETE
      - PATCH
    - request body content types:
      - `application/json`
      - `application/x-www-form-urlencoded`
      - `multipart/form-data`
    - response body content types:
      - `application/json`
      - `text/plain`
      - `text/html`

  Yielding the following full list of request functions:
    - `getJson()`
    - `getText()`
    - `getHtml()`
    - `postForJson()`
    - `postForText()`
    - `postForHtml()`
    - `putForJson()`
    - `putForText()`
    - `putForHtml()`
    - `deleteForJson()`
    - `deleteForText()`
    - `deleteForHtml()`
    - `patchForJson()`
    - `patchForText()`
    - `patchForHtml()`
- BREAKING CHANGE:
  `getJson()` and `postForJson()` can now return `String` instances
  in addition to objects and arrays,
  if the server returns JSON-encoded strings.
  (This is unlikely for MediaWiki core’s REST API endpoints,
  but common in the Wikibase REST API.)
- BREAKING CHANGE:
  The `body` property of the `RestApiServerError`,
  `RestApiClientError` and `UnexpectedResponseStatus` classes
  is now documented with the type `*` (“any”) rather than `string|Object`.
  The previous type was incorrect – if the server response is JSON,
  m3api-rest just decodes it for the error without checking if it’s an object or not.
  (You almost certainly don’t need to care about this change,
  but it’s technically breaking.)

## v0.1.1 (2026-04-05)

- Updated the library for the new network interface of m3api v1.1.0,
  so that it can be used together with that version.
  (This also unlocks many new features in m3api-rest,
  which will be implemented in a subsequent release.)
- Introduced a new error type, `IncompatibleResponseType`,
  thrown if the server responds with an incompatible response type.
- Updated dependencies.

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
