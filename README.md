# m3api-rest

m3api-rest is an extension package for [m3api],
allowing you to interact with the MediaWiki REST API.

## Request functions

m3api-rest includes functions to make GET and POST requests that return JSON responses.
Other request methods and response content types will be added in future versions.
All functions start with the HTTP method name (in lowercase);
for GET functions, this is directly followed by the response type (e.g. `getJson`),
while other functions have the word “for” in between (e.g. `postForJson`)
to clarify that this is the response content type, not the request content type.
(The content type of the request body is specified by the type of the body passed into the function;
currently `postForJson` only supports `URLSearchParams` bodies,
but in future versions the same function will support multiple body types.)

### `getJson`

Make a GET request for some JSON data.
Usage examples:

```js
import Session from 'm3api';
import { getJson, path } from 'm3api-rest';

const session = new Session( 'en.wikipedia.org', {}, {
	userAgent: 'm3api-rest-README-example',
} );

const title = 'Main page';
const page = await getJson( session, path`/v1/page/${ title }` );
console.log( page ); // { id: 217225, title: 'Main page', ... }
```

```js
const searchResults = await getJson( session, '/v1/search/page', {
	q: 'search query',
	limit: 10,
} );
console.log( searchResults ); // { pages: [ { title: 'Web query', ... }, ... ] }
```

See also below for details on the different ways to specify parameters.

### `postForJson`

Make a POST request that will return some JSON data.
Usage example:

```js
const wikitext = '== ==\nThis is <span id=id>bad</span> <span id=id>wikitext</span>.';
const lints = await postForJson( session, '/v1/transform/wikitext/to/lint', new URLSearchParams( {
	wikitext,
} ) );
console.log( lints ); // [ { type: 'empty-heading', ... }, { type: 'duplicate-ids', ... } ]
```

(Note that some endpoints, including `POST /v1/page`, cannot be used yet,
because m3api-rest can currently only send `application/x-www-form-urlencoded` request bodies
but those endpoints require `application/json`.
This will be fixed in a future version.)

## Specifying parameters

REST API endpoints have different kinds of parameters.
Many endpoints take parameters in the path, written like `/v1/page/{title}` (`title` is a parameter);
many endpoints take query parameters after the path, like `/v1/search/page?q=search` (`q` is a parameter);
and non-GET endpoints (POST etc.) take body parameters in several encodings.
m3api-rest supports several ways to specify these parameters.

### Path parameters

Path parameters can be specified using a tagged template literal (string template)
using the `path` function,
which will encode the parameter value if necessary.

```js
import { path } from 'm3api-rest';

const title = 'AC/DC';
const url = path`/v1/page/${ title }`; // /v1/page/AC%2FDC
```

To use it, take the endpoint URL and change `{parameters}` to `${substitutions}`
(or `${ substitutions }` with spaces, depending on your code style).

Alternatively, you can pass the original endpoint URL into the request function unmodified,
and the request function will pull the parameters out of the params passed into it.
For example:

```js
const page = await getJson( session, '/v1/page/{title}', {
	// this object contains the params for the request
	title: 'AC/DC', // this is a path parameter
	redirect: true, // this is a query parameter, see below
} );
// makes a request to /v1/page/AC%2FDC?redirect=true
```

### Query parameters

The GET request functions, e.g. `getJson`, take an object with query parameters after the path:

```js
const searchResults = await getJson( session, '/v1/search/page', {
	q: 'search query',
	limit: 10,
} );
// makes a request to /v1/search/page?q=search%20query&limit=10
```

As mentioned above, you can also specify path parameters here.

Request functions for other methods don’t take an object with query parameters,
since they already take a request body.
Instead, if the endpoint still takes query parameters (which is uncommon, but possible),
you should pass them into the `path` as an object:

```js
const params = { fakeQueryParam: 'abc' };
await postForJson( path`/v0/fake/endpoint?${ params }`, new URLSearchParams( {
	fakeBodyParam: 'xyz',
} ) );
// makes a request to /v0/fake/endpoint?fakeQueryParam=abc with fakeBodyParam=xyz in the body
```

This is also possible for GET requests, but you should probably prefer passing the query parameters separately there.

### Body parameters

The non-GET request functions, e.g. `postForJson`, take a value for the body after the path.
The type of the value encodes the content type with which the body will be sent.
Currently, the only supported type is `URLSearchParams`,
which will send the body as `application/x-www-form-urlencoded`;
support for other body types
(`FormData` for `multipart/form-data`, plain object for `application/json`)
will be added in a future version.

```js
const lints = await postForJson( session, '/v1/transform/wikitext/to/lint', new URLSearchParams( {
	wikitext: 'some wikitext',
} ) );
/// makes a request to /v1/transform/wikitext/to/lint with wikitext=some%20wikitext
```

As mentioned above, you can also specify path parameters here.

## License

Published under the [ISC License][].
By contributing to this software,
you agree to publish your contribution under the same license.

[m3api]: https://www.npmjs.com/package/m3api
[ISC License]: https://spdx.org/licenses/ISC.html
