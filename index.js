/**
 * An Error representing an HTTP 5xx response from the REST API.
 */
export class RestApiServerError extends Error {

	/**
	 * @param {number} status The invalid status code received from the API.
	 * @param {string|Object} body The response body received from the API.
	 */
	constructor( status, body ) {
		super( `REST API server error: ${ status }\n\n${ body }` );

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
		super( `REST API client error: ${ status }\n\n${ body }` );

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
 * Check the status code of the response and potentially throw an error based on it.
 *
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
}

/**
 * Get the body of the response and check that it’s valid JSON.
 *
 * @param {Object} internalResponse
 * @return {Object|Array}
 */
function getResponseJson( internalResponse ) {
	const { body } = internalResponse;
	if ( typeof body === 'object' && body !== null ) {
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
 * (Calling this function like a regular function is not very useful,
 * so you can ignore the parameters documented below.)
 *
 * @param {string[]} strings
 * @param {Array} values
 * @return {string}
 */
export function path( strings, ...values ) {
	return String.raw( { raw: strings }, ...values.map( encodeURIComponent ) );
}

/**
 * Make a GET request to a REST API endpoint and return the JSON-decoded body.
 *
 * @param {Session} session The m3api session to use for this request.
 * @param {string} path The resource path, e.g. `/v1/search`.
 * Does not include the domain, script path, or `rest.php` endpoint.
 * Use the {@link path} tag function to build the path.
 * @param {Options} [options] Request options.
 * @return {Object|Array} The body of the API response, JSON-decoded.
 */
export async function getJson( session, path, options = {} ) {
	const restUrl = session.apiUrl.replace( /api\.php$/, 'rest.php' );
	const url = restUrl + path;
	const params = {};
	const headers = {
		accept: 'application/json',
		'user-agent': session.getUserAgent( options ),
	};
	const internalResponse = await session.internalGet( url, params, headers );
	checkResponseStatus( internalResponse );
	return getResponseJson( internalResponse );
}

/**
 * Make a POST request to a REST API endpoint and return the JSON-decoded body.
 *
 * @param {Session} session The m3api session to use for this request.
 * @param {string} path The resourcee path, e.g. `/v1/page`.
 * Does not include the domain, script path, or `rest.php` endpoint.
 * Use the {@link path} tag function to build the path.
 * @param {URLSearchParams} params The request body.
 * Will be sent using the `application/x-www-form-urlencoded` content type.
 * (Future versions of this library will support additional request body content types,
 * but that requires changes to m3api first.)
 * @param {Options} [options] Request options.
 * @return {Object|Array} The body of the API response, JSON-decoded.
 */
export async function postForJson( session, path, params, options = {} ) {
	const restUrl = session.apiUrl.replace( /api\.php$/, 'rest.php' );
	const url = restUrl + path;
	const urlParams = {};
	const bodyParams = {};
	for ( const [ key, value ] of params ) {
		if ( Object.prototype.hasOwnProperty.call( bodyParams, key ) ) {
			throw new Error( `Duplicate param name not yet supported: ${ key }` );
		}
		bodyParams[ key ] = value;
	}
	const headers = {
		// accept: 'application/json', // skip this for now due to T412610
		'user-agent': session.getUserAgent( options ),
	};
	const internalResponse = await session.internalPost( url, urlParams, bodyParams, headers );
	checkResponseStatus( internalResponse );
	return getResponseJson( internalResponse );
}
