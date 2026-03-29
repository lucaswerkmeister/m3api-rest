/* eslint-env mocha */

import { Session } from 'm3api/core.js';
import {
	InvalidPathParams,
	InvalidResponseBody,
	UnexpectedResponseStatus,
	IncompatibleResponseType,
	UnknownResponseError,
	RestApiClientError,
	RestApiServerError,
	deleteForHtml,
	deleteForJson,
	deleteForText,
	getHtml,
	getJson,
	getResponseStatus,
	getText,
	patchForHtml,
	patchForJson,
	patchForText,
	path,
	postForHtml,
	postForJson,
	postForText,
	putForHtml,
	putForJson,
	putForText,
} from '../../index.js';
import chaiBox from '../helper/box.js';
import { File } from 'buffer'; // only available globally since Node 20
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiString from 'chai-string';
use( chaiAsPromised );
use( chaiBox );
use( chaiString );

/**
 * Get the headers of the given options as a plain object,
 * for more convenient assertions.
 *
 * @param {RequestInit} options
 * @return {Object} All keys are lowercase.
 */
function getHeaders( options ) {
	return Object.fromEntries( new Headers( options.headers ).entries() );
}

/**
 * Conveniently construct a URL for assertions.
 *
 * @param {string} base
 * @param {Object|null} params
 * @return {URL}
 */
function url( base, params = null ) {
	const url = new URL( base );
	if ( params !== null ) {
		url.search = new URLSearchParams( params );
	}
	return url;
}

/**
 * Return a Session that expects a single fetch() call
 * and returns a response from the given parameters.
 * The input to the fetch() call is ignored.
 *
 * @param {Response|string|Object} responseOrBody An existing response,
 * or the body of a text or JSON response.
 * @param {Object} options Response constructor options.
 * Ignored if responseOrBody is a Response.
 * @return {Session}
 */
function singleRequestSession( responseOrBody = {}, options = {} ) {
	let called = false;
	return new class TestSession extends Session {

		async fetch() {
			expect( called, 'already called' ).to.be.false;
			called = true;
			return responseOrBody instanceof Response ?
				responseOrBody :
				typeof responseOrBody === 'string' ?
					new Response( responseOrBody, options ) :
					Response.json( responseOrBody, options );
		}

	}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );
}

describe( 'path', () => {

	it( 'URI-encodes one parameter', () => {
		const title = 'AC/DC';
		const actual = path`/v1/page/${ title }/html`;
		expect( actual ).to.equal( '/v1/page/AC%2FDC/html' );
	} );

	it( 'URI-encodes two parameters', () => {
		const title = '?! (album)';
		const type = 'anonymous/temporary'; // fake value
		const actual = path`/v1/page/${ title }/history/counts/${ type }`;
		// TODO verify that the expected URL is correct
		// (unencoded parentheses and exclamation mark? space becomes %20 instead of underscore?)
		// once T411738 is fixed
		expect( actual ).to.equal( '/v1/page/%3F!%20(album)/history/counts/anonymous%2Ftemporary' );
	} );

	it( 'URI-encodes three parameters', () => {
		const id = 'I/D'; // fake value
		const wiki = 'en/wiki'; // fake value
		const revid = 'rev/id'; // fake value
		const actual = path`/campaignevents/v0/event_registration/${ id }/edits/${ wiki }/${ revid }`;
		expect( actual ).to.equal( '/campaignevents/v0/event_registration/I%2FD/edits/en%2Fwiki/rev%2Fid' );
	} );

	it( 'URI-encodes four parameters', () => {
		const skin = 'vector/2022'; // fake value
		const editor = 'visual/editor'; // fake value
		const tasktypeid = 'copy/edit'; // fake value
		const uselang = 'en/gb'; // fake value
		const actual = path`/growthexperiments/v0/quickstarttips/${ skin }/${ editor }/${ tasktypeid }/${ uselang }`;
		expect( actual ).to.equal( '/growthexperiments/v0/quickstarttips/vector%2F2022/visual%2Feditor/copy%2Fedit/en%2Fgb' );
	} );

	it( 'URI-encodes query parameters', () => {
		const id = 376020677;
		const params = { stash: false, flavor: 'view' };
		const actual = path`/v1/revision/${ id }/html?${ params }`;
		expect( actual ).to.equal( '/v1/revision/376020677/html?stash=false&flavor=view' );
	} );

} );

describe( 'getResponseStatus', () => {

	it( 'throws UnknownResponseError', () => {
		const response = { the: 'body' };
		expect( () => getResponseStatus( response ) )
			.to.throw( UnknownResponseError )
			.and.include( { response } );
	} );

	// the successful case is tested in getJson() below

} );

describe( 'getJson', () => {

	it( 'makes a request with the right URL and headers, registers the status and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/foo' ) );
				expect( options ).to.have.property( 'method', 'GET' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( called ).to.be.false;
				called = true;
				return Response.json( { the: 'body' } );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await getJson( session, '/foo', {}, {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
		expect( getResponseStatus( response ) ).to.equal( 200 );
	} );

	it( 'returns an array body and its status', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/list' ) );
				expect( called ).to.be.false;
				called = true;
				return Response.json( [ { index: 1 }, { index: 2 } ], {
					status: 299,
				} );
			}

		}( 'https://wiki.test/testw/api.php', {}, {
			userAgent: 'test-user-agent',
		} );

		const response = await getJson( session, '/list' );

		expect( called ).to.be.true;
		expect( response ).to.eql( [ { index: 1 }, { index: 2 } ] );
		expect( getResponseStatus( response ) ).to.equal( 299 );
	} );

	it( 'returns a string body and its status', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/string' ) );
				expect( called ).to.be.false;
				called = true;
				return Response.json( 'a string', {
					status: 299,
				} );
			}

		}( 'https://wiki.test/testw/api.php', {}, {
			userAgent: 'test-user-agent',
		} );

		const response = await getJson( session, '/string' );

		expect( called ).to.be.true;
		expect( response ).to.box( 'a string' );
		expect( getResponseStatus( response ) ).to.equal( 299 );
	} );

	describe( 'prepareGetRequest', () => {

		it( 'merges request params from the URL and function parameters', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource ) {
					expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/foo', {
						pathparam: 'path param',
						functionparam: 'function param',
					} ) );
					return Response.json( { the: 'body' } );
				}

			}( 'https://wiki.test/testw/api.php', {}, { userAgent: 'test-user-agent' } );

			const response = await getJson( session, path`/foo?${ { pathparam: 'path param' } }`, {
				functionparam: 'function param',
			} );

			expect( response ).to.eql( { the: 'body' } );
		} );

		it( 'sends an Authorization header if specified', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					const headers = getHeaders( options );
					expect( headers ).to.have.property( 'authorization', 'Bearer test access token' );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, {
				userAgent: 'test-user-agent',
				accessToken: 'test access token',
			} );

			const response = await getJson( session, '/foo' );

			expect( response ).to.eql( { the: 'body' } );
		} );

	} );

	describe( 'substitutePathParams', () => {

		it( 'pulls path params out of the params', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource ) {
					expect( resource ).to.eql( url( 'https://wiki.test/w/rest.php/foo/BAR/baz/QUX', {
						foo: 'FOO',
						baz: 'BAZ',
					} ) );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

			const path = '/foo/{bar}/baz/{qux}';
			const params = {
				foo: 'FOO',
				bar: 'BAR',
				baz: 'BAZ',
				qux: 'QUX',
			};
			const response = await getJson( session, path, params );

			expect( response ).to.eql( { the: 'body' } );
			expect( params, 'original params (unmodified)' ).to.eql( {
				foo: 'FOO',
				bar: 'BAR',
				baz: 'BAZ',
				qux: 'QUX',
			} );
		} );

		it( 'URI-encodes path params', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource ) {
					expect( resource ).to.eql( url( 'https://wiki.test/w/rest.php/foo/BAR%2FBAZ/qux' ) );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

			const response = await getJson( session, '/foo/{bar}/qux', {
				bar: 'BAR/BAZ',
			} );

			expect( response ).to.eql( { the: 'body' } );
		} );

		it( 'throws InvalidPathParams for missing param', async () => {
			const session = new Session( 'wiki.test' );

			const path = '/foo/{bar}/baz/{qux}';
			const params = { bar: 'BAR' };

			await expect( getJson( session, path, params ) )
				.to.be.rejectedWith( InvalidPathParams, 'Unspecified path param {qux}' )
				.and.eventually.include( { path, paramName: 'qux', params } );
		} );

	} );

	describe( 'checkResponseStatus', () => {

		const body = { the: 'body' };

		describe( 'throws RestApiServerError for', () => {

			for ( const status of [ 500, 504, 599 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = singleRequestSession( body, { status } );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiServerError )
						.and.eventually.deep.include( { status, body } );
				} );
			}

		} );

		describe( 'throws RestApiClientError for', () => {

			for ( const status of [ 400, 404, 499 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = singleRequestSession( body, { status } );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiClientError )
						.and.eventually.deep.include( { status, body } );
				} );
			}

		} );

		describe( 'throws UnexpectedResponseStatus for', () => {

			for ( const status of [ 300, 302, 399 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = singleRequestSession( body, { status } );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( UnexpectedResponseStatus )
						.and.eventually.deep.include( { status, body } );
				} );
			}

		} );

	} );

	describe( 'getResponseMimeType, isResponseJson, getResponseJson', () => {

		it( 'allows application/custom+json', async () => {
			const session = singleRequestSession( { the: 'body' }, {
				headers: {
					'Content-Type': 'application/custom+json',
				},
			} );

			const response = await getJson( session, '/foo' );

			expect( response ).to.eql( { the: 'body' } );
		} );

		it( 'allows application/json; charset=utf-8', async () => {
			const session = singleRequestSession( { the: 'body' }, {
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
				},
			} );

			const response = await getJson( session, '/foo' );

			expect( response ).to.eql( { the: 'body' } );
		} );

		describe( 'throws InvalidResponseBody for', () => {

			for ( const body of [ true, false, null, 0, 1 ] ) {
				it( JSON.stringify( body ), async () => {
					const session = singleRequestSession( Response.json( body ) );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( InvalidResponseBody )
						.and.eventually.include( { body } );
				} );
			}

		} );

		it( 'throws IncompatibleResponseType for text/plain', async () => {
			const session = singleRequestSession( {}, {
				headers: {
					'Content-Type': 'text/plain',
				},
			} );

			await expect( getJson( session, '/foo' ) )
				.to.be.rejectedWith( IncompatibleResponseType )
				.and.eventually.include( {
					expectedType: 'application/json',
					actualType: 'text/plain',
					body: '{}',
				} );
		} );

	} );

} );

describe( 'getText', () => {

	it( 'makes a request with the right URL and headers, registers the status and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/foo' ) );
				expect( options ).to.have.property( 'method', 'GET' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/plain' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( called ).to.be.false;
				called = true;
				return new Response( 'the body', {
					headers: {
						'Content-Type': 'text/plain',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await getText( session, '/foo', {}, {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( 'the body' );
		expect( getResponseStatus( response ) ).to.equal( 200 );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( getText( session, '/foo' ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

	describe( 'getResponseMimeType, isResponseText, getResponseText', () => {

		it( 'allows text/custom+plain', async () => {
			const session = singleRequestSession( 'the body', {
				headers: {
					'Content-Type': 'text/custom+plain',
				},
			} );

			const response = await getText( session, '/foo' );

			expect( response ).to.box( 'the body' );
		} );

		it( 'allows text/plain; charset=utf-8', async () => {
			const session = singleRequestSession( 'the body', {
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
				},
			} );

			const response = await getText( session, '/foo' );

			expect( response ).to.box( 'the body' );
		} );

		it( 'throws IncompatibleResponseType for application/json', async () => {
			const session = singleRequestSession( '{}', {
				headers: {
					'Content-Type': 'application/json',
				},
			} );

			await expect( getText( session, '/foo' ) )
				.to.be.rejectedWith( IncompatibleResponseType )
				.and.eventually.deep.include( {
					expectedType: 'text/plain',
					actualType: 'application/json',
					body: {},
				} );
		} );

		it( 'throws IncompatibleResponseType for text/html', async () => {
			const session = singleRequestSession( '<p>the body</p>', {
				headers: {
					'Content-Type': 'text/html',
				},
			} );

			await expect( getText( session, '/foo' ) )
				.to.be.rejectedWith( IncompatibleResponseType )
				.and.eventually.include( {
					expectedType: 'text/plain',
					actualType: 'text/html',
					body: '<p>the body</p>',
				} );
		} );

	} );

} );

describe( 'getHtml', () => {

	it( 'makes a request with the right URL and headers, registers the status and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/foo' ) );
				expect( options ).to.have.property( 'method', 'GET' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/html' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( called ).to.be.false;
				called = true;
				return new Response( '<p>the body</p>', {
					headers: {
						'Content-Type': 'text/html',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await getHtml( session, '/foo', {}, {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( '<p>the body</p>' );
		expect( getResponseStatus( response ) ).to.equal( 200 );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( getHtml( session, '/foo' ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

	describe( 'getResponseMimeType, isResponseHtml, getResponseHtml', () => {

		it( 'allows text/custom+html', async () => {
			const session = singleRequestSession( '<p>the body</p>', {
				headers: {
					'Content-Type': 'text/custom+html',
				},
			} );

			const response = await getHtml( session, '/foo' );

			expect( response ).to.box( '<p>the body</p>' );
		} );

		it( 'allows text/html; charset=utf-8', async () => {
			const session = singleRequestSession( '<p>the body</p>', {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
				},
			} );

			const response = await getHtml( session, '/foo' );

			expect( response ).to.box( '<p>the body</p>' );
		} );

		it( 'throws IncompatibleResponseType for application/json', async () => {
			const session = singleRequestSession( '{}', {
				headers: {
					'Content-Type': 'application/json',
				},
			} );

			await expect( getHtml( session, '/foo' ) )
				.to.be.rejectedWith( IncompatibleResponseType )
				.and.eventually.deep.include( {
					expectedType: 'text/html',
					actualType: 'application/json',
					body: {},
				} );
		} );

		it( 'throws IncompatibleResponseType for text/plain', async () => {
			const session = singleRequestSession( 'the body', {
				headers: {
					'Content-Type': 'text/plain',
				},
			} );

			await expect( getHtml( session, '/foo' ) )
				.to.be.rejectedWith( IncompatibleResponseType )
				.and.eventually.include( {
					expectedType: 'text/html',
					actualType: 'text/plain',
					body: 'the body',
				} );
		} );

	} );

} );

describe( 'postForJson', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'POST' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( /* 'accept', */ 'user-agent' );
				// expect( headers.accept ).to.equal( 'application/json' ); // T412610
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( [
					[ 'param1', 'abc' ],
					[ 'param1', 'def' ],
					[ 'param2', 'xyz' ],
				] ) );
				expect( called ).to.be.false;
				called = true;
				return Response.json( { the: 'body' } );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await postForJson( session, '/bar', new URLSearchParams( [
			[ 'param1', 'abc' ],
			[ 'param1', 'def' ],
			[ 'param2', 'xyz' ],
		] ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( { the: 'body' }, { status: 404 } );

		await expect( postForJson( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: { the: 'body' },
			} );
	} );

	describe( 'encodeBody', () => {

		it( 'supports JSON bodies', async () => {
			let called = false;
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					const headers = getHeaders( options );
					expect( headers ).to.have.property( 'content-type', 'application/json' );
					expect( options.body ).to.equal( '{"param1":"abc","param2":"xyz"}' );
					called = true;
					return Response.json( {} );
				}

			}( 'wiki.test' );

			await postForJson( session, '/bar', {
				param1: 'abc',
				param2: 'xyz',
			}, {
				userAgent: 'test-user-agent',
			} );

			expect( called ).to.be.true;
		} );

		it( 'supports URLSearchParams bodies', async () => {
			let called = false;
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					expect( options.body ).to.eql( new URLSearchParams( [
						[ 'param1', 'abc' ],
						[ 'param1', 'def' ],
						[ 'param2', 'xyz' ],
					] ) );
					expect( called ).to.be.false;
					called = true;
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test' );

			await postForJson( session, '/bar', new URLSearchParams( [
				[ 'param1', 'abc' ],
				[ 'param1', 'def' ],
				[ 'param2', 'xyz' ],
			] ), {
				userAgent: 'test-user-agent',
			} );

			expect( called ).to.be.true;
		} );

		it( 'supports FormData bodies', async () => {
			const blob = new Blob( [ 'a blob' ], { type: 'text/blob+plain' } );
			const file = new File( [ 'a file' ], 'file.txt', { type: 'text/plain' } );
			let called = false;
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					const { body } = options;
					expect( body ).to.be.an.instanceof( FormData );
					expect( [ ...body.keys() ] ).to.eql( [
						'string',
						'blob',
						'file',
					] );
					expect( body.getAll( 'string' ) ).to.eql( [ 'a string' ] );
					// FormData turns the Blob into a File so we cannot assert .eql( [ blob ] )
					expect( body.getAll( 'blob' ) ).to.have.length( 1 );
					expect( body.get( 'blob' ) ).to.have.property( 'type', 'text/blob+plain' );
					expect( body.getAll( 'file' ) ).to.eql( [ file ] );
					called = true;
					return Response.json( {} );
				}

			}( 'wiki.test' );

			const body = new FormData();
			body.set( 'string', 'a string' );
			body.set( 'blob', blob );
			body.set( 'file', file );
			await postForJson( session, '/baz', body, {
				userAgent: 'test-user-agent',
			} );

			expect( called ).to.be.true;
		} );

	} );

	describe( 'prepareRequestWithBody, preparePostRequest', () => {

		it( 'sends an Authorization header if specified', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					const headers = getHeaders( options );
					expect( headers ).to.have.property( 'authorization', 'Bearer test access token' );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, {
				userAgent: 'test-user-agent',
				accessToken: 'test access token',
			} );

			const response = await postForJson( session, '/foo', new URLSearchParams() );

			expect( response ).to.eql( { the: 'body' } );
		} );

	} );

	describe( 'substitutePathParams', () => {

		it( 'pulls path params out of URLSearchParams params', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					expect( resource ).to.eql( url( 'https://wiki.test/w/rest.php/foo/BAR/baz/QUX' ) );
					expect( options.body ).to.eql( new URLSearchParams( {
						foo: 'FOO',
						baz: 'BAZ',
					} ) );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

			const path = '/foo/{bar}/baz/{qux}';
			const params = new URLSearchParams( [
				[ 'foo', 'FOO' ],
				[ 'bar', 'BAR' ],
				[ 'baz', 'BAZ' ],
				[ 'qux', 'QUX' ],
			] );
			const response = await postForJson( session, path, params );

			expect( response ).to.eql( { the: 'body' } );
			expect( [ ...params.entries() ], 'original params (unmodified)' ).to.eql( [
				[ 'foo', 'FOO' ],
				[ 'bar', 'BAR' ],
				[ 'baz', 'BAZ' ],
				[ 'qux', 'QUX' ],
			] );
		} );

		it( 'pulls path params out of FormData params', async () => {
			const file = new File( [ 'BAZ' ], 'file.txt', { type: 'text/plain' } );
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					expect( resource ).to.eql( url( 'https://wiki.test/w/rest.php/foo/BAR/baz/QUX' ) );
					const expectedBody = new FormData();
					expectedBody.set( 'foo', 'FOO' );
					expectedBody.set( 'baz', file );
					expect( options.body ).to.eql( expectedBody );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

			const path = '/foo/{bar}/baz/{qux}';
			const params = new FormData();
			params.set( 'foo', 'FOO' );
			params.set( 'bar', 'BAR' );
			params.set( 'baz', file );
			params.set( 'qux', 'QUX' );
			const response = await postForJson( session, path, params );

			expect( response ).to.eql( { the: 'body' } );
			expect( [ ...params.entries() ], 'original params (unmodified)' ).to.eql( [
				[ 'foo', 'FOO' ],
				[ 'bar', 'BAR' ],
				[ 'baz', file ],
				[ 'qux', 'QUX' ],
			] );
		} );

		it( 'URI-encodes path params', async () => {
			const session = new class TestSession extends Session {

				async fetch( resource, options ) {
					expect( resource ).to.eql( url( 'https://wiki.test/w/rest.php/foo/BAR%2FBAZ/qux' ) );
					expect( options.body ).to.eql( new URLSearchParams() );
					return Response.json( { the: 'body' } );
				}

			}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

			const response = await postForJson( session, '/foo/{bar}/qux', new URLSearchParams( {
				bar: 'BAR/BAZ',
			} ) );

			expect( response ).to.eql( { the: 'body' } );
		} );

		it( 'throws InvalidPathParams for missing param', async () => {
			const session = new Session( 'wiki.test' );

			const path = '/foo/{bar}/baz/{qux}';
			const params = new URLSearchParams( [ [ 'bar', 'BAR' ] ] );

			await expect( postForJson( session, path, params ) )
				.to.be.rejectedWith( InvalidPathParams, 'Unspecified path param {qux}' )
				.and.eventually.include( { path, paramName: 'qux', params } );
		} );

		it( 'throws InvalidPathParams for ambiguous param', async () => {
			const session = new Session( 'wiki.test' );

			const path = '/foo/{bar}/baz/{qux}';
			const params = new URLSearchParams( [
				[ 'bar', 'BAR' ],
				[ 'qux', 'QUX' ],
				[ 'qux', 'QUY' ],
			] );

			await expect( postForJson( session, path, params ) )
				.to.be.rejectedWith( InvalidPathParams, 'Ambiguous path param {qux}' )
				.and.eventually.include( { path, paramName: 'qux', params } );
		} );

		for ( const param of [
			new Blob( [ 'a blob' ], { type: 'text/plain' } ),
			new File( [ 'a file' ], 'file.txt', { type: 'text/plain' } ),
		] ) {
			it( `throws InvalidPathParams for ${ param.constructor.name } param`, async () => {
				const session = new Session( 'wiki.test' );

				const path = '/foo/{bar}';
				const params = new FormData();
				params.set( 'bar', param );

				await expect( postForJson( session, path, params ) )
					.to.be.rejectedWith( InvalidPathParams, 'Path param {bar} cannot be a Blob or File' )
					.and.eventually.include( { path, paramName: 'bar', params } );
			} );
		}

	} );

} );

describe( 'postForText', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'POST' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/plain' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( 'the body', {
					headers: {
						'Content-Type': 'text/plain',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await postForText( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( 'the body' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( postForText( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'postForHtml', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'POST' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/html' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( '<p>the body</p>', {
					headers: {
						'Content-Type': 'text/html',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await postForHtml( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( '<p>the body</p>' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( postForHtml( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'putForJson', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'PUT' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return Response.json( { the: 'body' } );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await putForJson( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( { the: 'body' }, { status: 404 } );

		await expect( putForJson( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: { the: 'body' },
			} );
	} );

} );

describe( 'putForText', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'PUT' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/plain' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( 'the body', {
					headers: {
						'Content-Type': 'text/plain',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await putForText( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( 'the body' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( putForText( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'putForHtml', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'PUT' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/html' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( '<p>the body</p>', {
					headers: {
						'Content-Type': 'text/html',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await putForHtml( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( '<p>the body</p>' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( putForHtml( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'deleteForJson', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'DELETE' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return Response.json( { the: 'body' } );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await deleteForJson( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( { the: 'body' }, { status: 404 } );

		await expect( deleteForJson( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: { the: 'body' },
			} );
	} );

} );

describe( 'deleteForText', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'DELETE' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/plain' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( 'the body', {
					headers: {
						'Content-Type': 'text/plain',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await deleteForText( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( 'the body' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( deleteForText( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'deleteForHtml', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'DELETE' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/html' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( '<p>the body</p>', {
					headers: {
						'Content-Type': 'text/html',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await deleteForHtml( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( '<p>the body</p>' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( deleteForHtml( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'patchForJson', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'PATCH' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return Response.json( { the: 'body' } );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await patchForJson( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( { the: 'body' }, { status: 404 } );

		await expect( patchForJson( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: { the: 'body' },
			} );
	} );

} );

describe( 'patchForText', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'PATCH' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/plain' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( 'the body', {
					headers: {
						'Content-Type': 'text/plain',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await patchForText( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( 'the body' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( patchForText( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );

describe( 'patchForHtml', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/bar' ) );
				expect( options ).to.have.property( 'method', 'PATCH' );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'text/html' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( options.body ).to.eql( new URLSearchParams( { param: 'value' } ) );
				expect( called ).to.be.false;
				called = true;
				return new Response( '<p>the body</p>', {
					headers: {
						'Content-Type': 'text/html',
					},
				} );
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await patchForHtml( session, '/bar', new URLSearchParams( {
			param: 'value',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.box( '<p>the body</p>' );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = singleRequestSession( 'the body', { status: 404 } );

		await expect( patchForHtml( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: 'the body',
			} );
	} );

} );
