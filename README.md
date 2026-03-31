# m3api-rest

m3api-rest is an extension package for [m3api],
allowing you to interact with the MediaWiki REST API.

## Usage examples

Before digging into all the available features in m3api-rest,
let’s start with some examples for commonly used functions.

### `getJson`

Make a GET request for some JSON data.

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

```js
const session = new Session( 'test.wikipedia.org', {}, {
	userAgent: 'm3api-rest-README-example',
	accessToken: ...,
} );

const title = 'Test page',
	source = 'Test page contents',
	comment = 'test edit';
const response = await postForJson( session, '/v1/page', {
	title,
	source,
	comment,
} );
console.log( `Created new page with page ID ${ response.id }` );
```

```js
const wikitext = '== ==\nThis is <span id=id>bad</span> <span id=id>wikitext</span>.';
const lints = await postForJson( session, '/v1/transform/wikitext/to/lint', new URLSearchParams( {
	wikitext,
} ) );
console.log( lints ); // [ { type: 'empty-heading', ... }, { type: 'duplicate-ids', ... } ]
```

### `putForJson`

Make a PUT request that will return some JSON data.

```js
// session should still have an accessToken, like in the previous example
const title = 'Test page';
const page = await getJson( session, path`/v1/page/${ title }` );
const updatedPage = await putForJson( session, path`/v1/page/${ title }`, {
	source: page.source.replace( /privledge/g, 'privilege' ), // example typo fix
	comment: 'test edit',
	content_model: page.content_model,
	latest: page.latest,
} );
console.log( `Edited page with revision ID ${ updatedPage.latest.id }` );
```

### `getHtml`

Make a GET request that will return HTML.
The HTML is returned as a `String`;
if you want to turn it into a DOM, you will need to parse it yourself,
e.g. using a [`DOMParser`][] in the browser or [jsdom][] on Node.js.

```js
const title = 'Douglas Adams';
const html = await getHtml( session, path`/v1/page/${ title }/html` );
const dom = new DOMParser().parseFromString( html, 'text/html' );
const rudimentaryLeadParagraph = dom.querySelector( 'p:not( .mw-empty-elt )' );
```

### `postForText`, `postForHtml`

Make GET requests that will return text or HTML, respectively.
As with `getHtml`, the result is returned as a `String`.
You can use these functions to convert between wikitext and HTML, for instance.

```js
const wikitext = "''Hello, world!''";
const html = await postForHtml( session, '/v1/transform/wikitext/to/html', {
	wikitext,
} );
console.log( html.valueOf() );
// <!DOCTYPE html>...<i ...>Hello, world!</i>
const wikitext2 = await postForText( session, '/v1/transform/html/to/wikitext', {
	html,
} );
console.log( wikitext2.valueOf() );
// ''Hello, world!''
```

## Request functions

m3api-rest supports the following:

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

### Request methods and response body content types

Each combination of request method and response body content type has a separate function,
whose name begins with the HTTP method name (in lowercase).
For GET functions, this is directly followed by the response type (e.g. `getJson`),
while other functions have the word “for” in between (e.g. `postForJson`)
to clarify that this is the response body content type, not the request body content type.
The response body content types are “json”, “text”, or “html”,
and included in the method name with an initial uppercase letter
(e.g. `getJson`, `postForText`, `postForHtml`).
Overall, the following functions are available:

- `getJson`
- `getText`
- `getHtml`
- `postForJson`
- `postForText`
- `postForHtml`
- `putForJson`
- `putForText`
- `putForHtml`
- `deleteForJson`
- `deleteForText`
- `deleteForHtml`
- `patchForJson`
- `patchForText`
- `patchForHtml`

### Request body content types

The request body type for non-GET request functions is determined
by the type of the object passed into the function,
i.e. the same function (e.g. `postForJson`) can send request bodies encoded in different ways.
For details, see the section on “body parameters” below.

### Specifying parameters

REST API endpoints have different kinds of parameters.
Many endpoints take parameters in the path, written like `/v1/page/{title}` (`title` is a parameter);
many endpoints take query parameters after the path, like `/v1/search/page?q=search` (`q` is a parameter);
and non-GET endpoints (POST etc.) take body parameters in several encodings.
m3api-rest supports several ways to specify these parameters.

#### Path parameters

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

#### Query parameters

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
await postForJson( path`/v0/fake/endpoint?${ params }`, {
	fakeBodyParam: 'xyz',
} );
// makes a request to /v0/fake/endpoint?fakeQueryParam=abc with {"fakeBodyParam":"xyz"} in the body
```

This is also possible for GET requests, but you should probably prefer passing the query parameters separately there.

#### Body parameters

The non-GET request functions, e.g. `postForJson`, take a value for the request body after the path.
The type of the value encodes the content type with which the request body will be sent:
a plain object is sent as `application/json`;
a `URLSearchParams` instance is sent as `application/x-www-form-urlencoded`;
and a `FormData` instance is sent as `multipart/form-data`.

```js
const wikitext = "''Hello, world!''";

// send as application/json
const html = await postForHtml(
	session,
	'/v1/transform/wikitext/to/html',
	{
		wikitext,
	},
);

// send as application/x-www-form-urlencoded
const html = await postForHtml(
	session,
	'/v1/transform/wikitext/to/html',
	new URLSearchParams( {
		wikitext,
	} ),
);

// send as multipart/form-data
const formData = new FormData();
formData.set( 'wikitext', wikitext );
const html = await postForHtml(
	session,
	'/v1/transform/wikitext/to/html',
	formData,
);
```

Note that not all REST API endpoints accept all request body content types.
Generally speaking, JSON is your safest bet,
but you should consult the API endpoint’s documentation to see what request bodies it accepts.

As mentioned above, you can also specify path parameters here.

## License

Published under the [ISC License][].
By contributing to this software,
you agree to publish your contribution under the same license.

[m3api]: https://www.npmjs.com/package/m3api
[`DOMParser`]: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
[jsdom]: https://www.npmjs.com/package/jsdom
[ISC License]: https://spdx.org/licenses/ISC.html
