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
	getJson,
	getResponseStatus,
	path,
	postForJson,
} from '../../index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiString from 'chai-string';
use( chaiAsPromised );
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

	it( 'returns an array body and its status', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async fetch( resource, options ) {
				expect( resource ).to.eql( url( 'https://wiki.test/testw/rest.php/list' ) );
				const headers = getHeaders( options );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
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

		class StatusReturningTestSession extends Session {

			constructor( status ) {
				super( 'wiki.test', {}, { userAgent: 'test-user-agent' } );
				this.status = status;
			}

			async fetch() {
				return Response.json( body, { status: this.status } );
			}

		}

		describe( 'throws RestApiServerError for', () => {

			for ( const status of [ 500, 504, 599 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiServerError )
						.and.eventually.deep.include( { status, body } );
				} );
			}

		} );

		describe( 'throws RestApiClientError for', () => {

			for ( const status of [ 400, 404, 499 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiClientError )
						.and.eventually.deep.include( { status, body } );
				} );
			}

		} );

		describe( 'throws UnexpectedResponseStatus for', () => {

			for ( const status of [ 300, 302, 399 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( UnexpectedResponseStatus )
						.and.eventually.deep.include( { status, body } );
				} );
			}

		} );

	} );

	describe( 'getResponseJson', () => {

		class BodyReturningTestSession extends Session {

			constructor( body, options ) {
				super( 'wiki.test', {}, { userAgent: 'test-user-agent' } );
				this.body = body;
				this.options = options;
			}

			async fetch() {
				return Response.json( this.body, this.options );
			}

		}

		describe( 'throws InvalidResponseBody for', () => {

			for ( const body of [ true, false, null, 'string', 0, 1, '{}' ] ) {
				it( JSON.stringify( body ), async () => {
					const session = new BodyReturningTestSession( body );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( InvalidResponseBody )
						.and.eventually.include( { body } );
				} );
			}

		} );

		it( 'throws IncompatibleResponseType for text/plain', async () => {
			const session = new BodyReturningTestSession( {}, {
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

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = new class StatusReturningTestSession extends Session {

			async fetch() {
				return Response.json( { the: 'body' }, { status: 404 } );
			}

		}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

		await expect( postForJson( session, '/foo', new URLSearchParams() ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: { the: 'body' },
			} );
	} );

	describe( 'substitutePathParams', () => {

		it( 'pulls path params out of the params', async () => {
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

	} );

} );
