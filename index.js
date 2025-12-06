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
 * @return {Object} The body of the API response, JSON-decoded.
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
	return internalResponse.body;
}
