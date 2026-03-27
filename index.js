/**
 * An Error representing an HTTP 5xx response from the REST API.
 */
export class RestApiServerError extends Error {

	/**
	 * @param {number} status The invalid status code received from the API.
	 * @param {string|Object} body The response body received from the API.
	 */
	constructor( status, body ) {
		super( `REST API server error: ${ status }\n\n${ JSON.stringify( body ) }` );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, RestApiServerError );
		}

		this.name = 'RestApiServerError';

		/**
		 * The invalid status code received from the API.
		 *
		 * @member {number}
		 */
		this.status = status;

		/**
		 * The body of the response.
		 *
		 * Depending on the response’s content type,
		 * this may be a string or a JSON-decoded object.
		 *
		 * @member {string|Object}
		 */
		this.body = body;
	}

}

/**
 * An Error representing an HTTP 4xx response from the REST API.
 */
export class RestApiClientError extends Error {

	/**
	 * @param {number} status The invalid status code received from the API.
	 * @param {string|Object} body The response body received from the API.
	 */
	constructor( status, body ) {
		super( `REST API client error: ${ status }\n\n${ JSON.stringify( body ) }` );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, RestApiClientError );
		}

		this.name = 'RestApiClientError';

		/**
		 * The invalid status code received from the API.
		 *
		 * @member {number}
		 */
		this.status = status;

		/**
		 * The body of the response.
		 *
		 * Depending on the response’s content type,
		 * this may be a string or a JSON-decoded object.
		 *
		 * @member {string|Object}
		 */
		this.body = body;
	}

}

/**
 * An Error representing an unexpected HTTP response status (1xx or 3xx) from the REST API.
 * 3xx responses are unexpected because the JavaScript runtime should have followed the redirect;
 * 1xx responses are unexpected because it should have awaited the non-informational response.
 */
export class UnexpectedResponseStatus extends Error {

	/**
	 * @param {number} status The unexpected status code received from the API.
	 * @param {string|Object} body The response body received from the API.
	 */
	constructor( status, body ) {
		super( `Unexpected REST API response status: ${ status }\n\n${ JSON.stringify( body ) }` );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, UnexpectedResponseStatus );
		}

		this.name = 'UnexpectedResponseStatus';

		/**
		 * The unexpected status code received from the API.
		 *
		 * @member {number}
		 */
		this.status = status;

		/**
		 * The body of the response.
		 *
		 * Depending on the response’s content type,
		 * this may be a string or a JSON-decoded object.
		 *
		 * @member {string|Object}
		 */
		this.body = body;
	}

}

/**
 * An Error representing an invalid body in the REST API response.
 */
export class InvalidResponseBody extends Error {

	/**
	 * @param {*} body The invalid response body received from the API.
	 */
	constructor( body ) {
		super( `Invalid REST API response body: ${ JSON.stringify( body ) }` );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, InvalidResponseBody );
		}

		this.name = 'InvalidResponseBody';

		/**
		 * The body of the response.
		 * Objects and arrays are expected response bodies,
		 * so an unexpected body is probably some kind of primitive value,
		 * such as a string, number or boolean.
		 *
		 * @member {*}
		 */
		this.body = body;
	}

}

/**
 * An Error thrown if {@link getResponseStatus} is called with an unknown response.
 *
 * {@link getResponseStatus} must be called with a value that was previously returned
 * by one of the request functions ({@link getJson} etc.).
 * If this error is thrown, then {@link getResponseStatus} was called with some other value,
 * and the response status cannot be determined.
 * This may be the result of calling the function incorrectly.
 *
 * The following example shows how {@link getResponseStatus} can be used correctly:
 * ```
 * const title = 'Main Page';
 * const page = await getJson( session, path`/v1/page/${ title }/bare` );
 * const status = getResponseStatus( page );
 * const { id, latest } = page;
 * ```
 *
 * For comparison, the following usage of {@link getResponseStatus} is **incorrect**:
 * ```
 * const title = 'Main Page';
 * const { id, latest } = await getJson( session, path`/v1/page/${ title }/bare` );
 * const status = getResponseStatus( { id, latest } ); // this does not work
 * ```
 */
export class UnknownResponseError extends Error {

	/**
	 * @param {*} response The unknown response passed into {@link getResponseStatus}.
	 */
	constructor( response ) {
		super( `Unknown REST API response: ${ JSON.stringify( response ) }` );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, UnknownResponseError );
		}

		this.name = 'UnknownResponseError';

		/**
		 * The unknown response passed into {@link getResponseStatus}.
		 *
		 * @member {*}
		 */
		this.response = response;
	}

}

/**
 * An Error thrown if a request path contains an unsubstituted parameter.
 *
 * For example, if {@link getJson} is called with the path `/v1/page/{title}`,
 * the `title` must be specified in the params, like this:
 * ```
 * const title = 'Main Page';
 * const page = await getJson( session, '/v1/page/{title}', { title } );
 * ```
 *
 * Alternatively, you can directly interpolate the title using {@link path}:
 * ```
 * const title = 'Main Page';
 * const page = await getJson( session, path`/v1/page/${ title }` );
 * ```
 *
 * But the following is invalid and will result in this error being thrown:
 * ```
 * const page = await getJson( session, '/v1/page/{title}' ); // which title?
 * // ^ throws InvalidPathParams
 * ```
 *
 * (Another, less common condition under which this error may be thrown
 * is that a path parameter was assigned multiple values;
 * this is possible with functions like {@link postForJson},
 * where the params of type {@link URLSearchParams} can contain
 * multiple values for the same name.)
 */
export class InvalidPathParams extends Error {

	constructor( message, path, paramName, params ) {
		super( message );

		if ( Error.captureStackTrace ) {
			Error.captureStackTrace( this, InvalidPathParams );
		}

		this.name = 'InvalidPathParams';

		this.path = path;

		this.paramName = paramName;

		this.params = params;
	}

}

/**
 * Check the status code of the response and potentially throw an error based on it.
 *
 * @private
 * @param {Object} internalResponse
 */
function checkResponseStatus( internalResponse ) {
	const { status, body } = internalResponse;
	if ( !Number.isInteger( status ) || status < 100 || status > 599 ) {
		// invalid status: RFC 9110 section 15 says treat it like 5xx
		throw new RestApiServerError( status, body );
	}
	if ( status >= 500 ) {
		throw new RestApiServerError( status, body );
	}
	if ( status >= 400 ) {
		throw new RestApiClientError( status, body );
	}
	if ( status < 200 || status >= 300 ) {
		throw new UnexpectedResponseStatus( status, body );
	}
}

const responseStatuses = new WeakMap();

/**
 * Get the HTTP status code for this response.
 *
 * @param {Object|Array} response A response object returned by one of the request functions
 * ({@link getJson} etc.). Note that it must be exactly the object returned by the function
 * (compared by identity, i.e. `===`), not a serialization of it or anything similar.
 * @return {number} The HTTP status code, i.e. an integer between 100 and 599.
 * (And for a successful response, really only between 200 and 299.)
 */
export function getResponseStatus( response ) {
	const status = responseStatuses.get( response );
	if ( status === undefined ) {
		throw new UnknownResponseError( response );
	}
	return status;
}

/**
 * Get the body of the response and check that it’s valid JSON.
 *
 * @private
 * @param {Object} internalResponse
 * @return {Object|Array}
 */
function getResponseJson( internalResponse ) {
	const { status, body } = internalResponse;
	if ( typeof body === 'object' && body !== null ) {
		responseStatuses.set( body, status );
		return body;
	} else {
		throw new InvalidResponseBody( body );
	}
}

/**
 * Encode a path for a REST API endpoint.
 *
 * This function should be used as a tag for a tagged template literal (template string).
 * Usage example:
 * ```
 * const title = 'AC/DC';
 * const json = await getJson( session, path`/v1/page/${ title }` );
 * // makes a request to /v1/page/AC%2FDC
 * ```
 *
 * Each parameter in the template can either be a string or an object of query params,
 * for example:
 * ```
 * const id = 376020677;
 * const params = { stash: false, flavor: 'view' };
 * const json = await getJson( session, path`/v1/revision/${ id }/html?${ params }` );
 * ```
 *
 * Alternatively, query params for GET requests can be specified separately:
 * ```
 * const id = 376020677;
 * const json = await getJson( session, path`/v1/revision/${ id }/html`, {
 *     stash: false,
 *     flavor: 'view',
 * } );
 * ```
 *
 * (Calling this function like a regular function is not very useful,
 * so you can ignore the parameters documented below.)
 *
 * @param {string|object[]} strings
 * @param {Array} values
 * @return {string}
 */
export function path( strings, ...values ) {
	return String.raw( { raw: strings }, ...values.map( ( value ) => {
		if ( typeof value === 'object' ) {
			return new URLSearchParams( value );
		}
		return encodeURIComponent( value );
	} ) );
}

/**
 * Substitute template expressions in the path,
 * taking values from the given params.
 *
 * @param {string} path The path with optional `{param}` expressions.
 * @param {Object|URLSearchParams} params The input params. Not modified.
 * @return {Object} The potentially modified path and params.
 */
function substitutePathParams( path, params ) {
	let copiedParams = null;
	const substitutedPath = path.replace( /\{[^{}]+\}/g, ( match ) => {
		const paramName = match.slice( 1, -1 );
		if ( params instanceof URLSearchParams ) {
			if ( copiedParams === null ) {
				copiedParams = new URLSearchParams( params );
			}
			const values = copiedParams.getAll( paramName );
			if ( values.length !== 1 ) {
				throw new InvalidPathParams(
					values.length === 0 ?
						`Unspecified path param ${ match }` :
						`Ambiguous path param ${ match }`,
					path,
					paramName,
					params,
				);
			}
			copiedParams.delete( paramName );
			return encodeURIComponent( values[ 0 ] );
		} else {
			if ( copiedParams === null ) {
				copiedParams = { ...params };
			}
			const value = copiedParams[ paramName ];
			if ( value === undefined ) {
				throw new InvalidPathParams(
					`Unspecified path param ${ match }`,
					path,
					paramName,
					params,
				);
			}
			delete copiedParams[ paramName ];
			return encodeURIComponent( value );
		}
	} );

	return { path: substitutedPath, params: copiedParams || params };
}

/**
 * Split a given URL for the m3api internal interface.
 *
 * @param {string} url
 * @return {Object}
 */
function splitUrlForInternalInterface( url ) {
	url = new URL( url );
	const urlParams = {};
	for ( const [ key, value ] of url.searchParams.entries() ) {
		urlParams[ key ] = value;
	}
	url.search = '';
	return { url: String( url ), urlParams };
}

/**
 * Make a GET request to a REST API endpoint and return the JSON-decoded body.
 *
 * @param {Session} session The m3api session to use for this request.
 * @param {string} path The resource path, e.g. `/v1/search`.
 * Does not include the domain, script path, or `rest.php` endpoint.
 * Use the {@link path} tag function to build the path.
 * @param {Object} [params] Parameters for the request URL.
 * This may include both parameters for the path and query parameters.
 * @param {Options} [options] Request options.
 * @return {Object|Array} The body of the API response, JSON-decoded.
 */
export async function getJson( session, path, params, options = {} ) {
	( { path, params } = substitutePathParams( path, params ) );
	const restUrl = session.apiUrl.replace( /api\.php$/, 'rest.php' );
	const { url, urlParams } = splitUrlForInternalInterface( restUrl + path );
	params = { ...urlParams, ...params };
	const headers = {
		accept: 'application/json',
		...session.getRequestHeaders( options ),
	};
	const internalResponse = await session.internalGet( url, params, headers );
	checkResponseStatus( internalResponse );
	return getResponseJson( internalResponse );
}

/**
 * Make a POST request to a REST API endpoint and return the JSON-decoded body.
 *
 * @param {Session} session The m3api session to use for this request.
 * @param {string} path The resource path, e.g. `/v1/page`.
 * Does not include the domain, script path, or `rest.php` endpoint.
 * Use the {@link path} tag function to build the path.
 * @param {URLSearchParams} params The request body.
 * Will be sent using the `application/x-www-form-urlencoded` content type.
 * (Future versions of this library will support additional request body content types,
 * but that requires changes to m3api first.)
 * You may also include parameters for the path here.
 * @param {Options} [options] Request options.
 * @return {Object|Array} The body of the API response, JSON-decoded.
 */
export async function postForJson( session, path, params, options = {} ) {
	( { path, params } = substitutePathParams( path, params ) );
	const restUrl = session.apiUrl.replace( /api\.php$/, 'rest.php' );
	const { url, urlParams } = splitUrlForInternalInterface( restUrl + path );
	const bodyParams = {};
	for ( const [ key, value ] of params ) {
		if ( Object.prototype.hasOwnProperty.call( bodyParams, key ) ) {
			throw new Error( `Duplicate param name not yet supported: ${ key }` );
		}
		bodyParams[ key ] = value;
	}
	const headers = {
		// accept: 'application/json', // skip this for now due to T412610
		...session.getRequestHeaders( options ),
	};
	const internalResponse = await session.internalPost( url, urlParams, bodyParams, headers );
	checkResponseStatus( internalResponse );
	return getResponseJson( internalResponse );
}
