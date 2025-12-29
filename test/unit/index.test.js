/* eslint-env mocha */

import { Session } from 'm3api/core.js';
import {
	InvalidPathParams,
	InvalidResponseBody,
	UnexpectedResponseStatus,
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

			async internalGet( url, params, headers ) {
				expect( url ).to.equal( 'https://wiki.test/testw/rest.php/foo' );
				expect( params ).to.eql( {} );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( called ).to.be.false;
				called = true;
				return {
					status: 200,
					headers: {},
					body: { the: 'body' },
				};
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

			async internalGet( url, params ) {
				expect( url ).to.equal( 'https://wiki.test/testw/rest.php/foo' );
				expect( params ).to.eql( {
					pathparam: 'path param',
					functionparam: 'function param',
				} );
				return {
					status: 200,
					headers: {},
					body: { the: 'body' },
				};
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

			async internalGet( url, params, headers ) {
				expect( url ).to.equal( 'https://wiki.test/testw/rest.php/list' );
				expect( params ).to.eql( {} );
				expect( headers ).to.have.all.keys( 'accept', 'user-agent' );
				expect( headers.accept ).to.equal( 'application/json' );
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( called ).to.be.false;
				called = true;
				return {
					status: 299,
					headers: {},
					body: [ { index: 1 }, { index: 2 } ],
				};
			}

		}( 'https://wiki.test/testw/api.php', {}, {
			userAgent: 'test-user-agent',
		} );

		const response = await getJson( session, '/list' );

		expect( called ).to.be.true;
		expect( response ).to.eql( [ { index: 1 }, { index: 2 } ] );
		expect( getResponseStatus( response ) ).to.equal( 299 );
	} );

	describe( 'substitutePathParams', () => {

		it( 'pulls path params out of the params', async () => {
			const session = new class TestSession extends Session {

				async internalGet( url, params ) {
					expect( url ).to.equal( 'https://wiki.test/w/rest.php/foo/BAR/baz/QUX' );
					expect( params ).to.eql( {
						foo: 'FOO',
						baz: 'BAZ',
					} );
					return {
						status: 200,
						headers: {},
						body: { the: 'body' },
					};
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

				async internalGet( url, params ) {
					expect( url ).to.equal( 'https://wiki.test/w/rest.php/foo/BAR%2FBAZ/qux' );
					expect( params ).to.eql( {} );
					return {
						status: 200,
						headers: {},
						body: { the: 'body' },
					};
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

			async internalGet() {
				return {
					status: this.status,
					headers: {},
					body,
				};
			}

		}

		describe( 'throws RestApiServerError for', () => {

			for ( const status of [ 500, 504, 599 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiServerError )
						.and.eventually.include( { status, body } );
				} );
			}

		} );

		describe( 'throws RestApiServerError for (invalid)', () => {

			for ( const status of [ 0, 99, 600, 599.9, 2000, 'not a number' ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiServerError )
						.and.eventually.include( { status, body } );
				} );
			}

		} );

		describe( 'throws RestApiClientError for', () => {

			for ( const status of [ 400, 404, 499 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( RestApiClientError )
						.and.eventually.include( { status, body } );
				} );
			}

		} );

		describe( 'throws UnexpectedResponseStatus for', () => {

			for ( const status of [ 100, 103, 199, 300, 302, 399 ] ) {
				it( JSON.stringify( status ), async () => {
					const session = new StatusReturningTestSession( status );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( UnexpectedResponseStatus )
						.and.eventually.include( { status, body } );
				} );
			}

		} );

	} );

	describe( 'getResponseJson', () => {

		class BodyReturningTestSession extends Session {

			constructor( body ) {
				super( 'wiki.test', {}, { userAgent: 'test-user-agent' } );
				this.body = body;
			}

			async internalGet() {
				return {
					status: 200,
					headers: {},
					body: this.body,
				};
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

	} );

} );

describe( 'postForJson', () => {

	it( 'makes a request with the right URL, headers and body and returns the body', async () => {
		let called = false;
		const session = new class TestSession extends Session {

			async internalPost( url, urlParams, bodyParams, headers ) {
				expect( url ).to.equal( 'https://wiki.test/testw/rest.php/bar' );
				expect( urlParams ).to.eql( {} );
				expect( bodyParams ).to.eql( {
					param1: 'abc',
					param2: 'xyz',
				} );
				expect( headers ).to.have.all.keys( /* 'accept', */ 'user-agent' );
				// expect( headers.accept ).to.equal( 'application/json' ); // T412610
				expect( headers[ 'user-agent' ] ).to.startWith( 'test-user-agent m3api/' );
				expect( called ).to.be.false;
				called = true;
				return {
					status: 200,
					headers: {},
					body: { the: 'body' },
				};
			}

		}( 'https://wiki.test/testw/api.php' );

		const response = await postForJson( session, '/bar', new URLSearchParams( {
			param1: 'abc',
			param2: 'xyz',
		} ), {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
	} );

	it( 'throws an error if the same param is given multiple times (instead of silently doing the wrong thing)', async () => {
		const session = new Session( 'wiki.test' );

		await expect( postForJson( session, '/', new URLSearchParams( [
			[ 'param', 'x' ],
			[ 'param', 'y' ],
		] ) ) ).to.be.rejectedWith( Error );
	} );

	it( 'throws a RestApiClientError for 404', async () => {
		// the rest of checkResponseStatus() is tested in getJson() above
		const session = new class StatusReturningTestSession extends Session {

			async internalGet() {
				return {
					status: 404,
					headers: {},
					body: { the: 'body' },
				};
			}

		}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

		await expect( getJson( session, '/foo' ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
				body: { the: 'body' },
			} );
	} );

	describe( 'substitutePathParams', () => {

		it( 'pulls path params out of the params', async () => {
			const session = new class TestSession extends Session {

				async internalPost( url, urlParams, bodyParams ) {
					expect( url ).to.equal( 'https://wiki.test/w/rest.php/foo/BAR/baz/QUX' );
					expect( urlParams ).to.eql( {} );
					expect( bodyParams ).to.eql( {
						foo: 'FOO',
						baz: 'BAZ',
					} );
					return {
						status: 200,
						headers: {},
						body: { the: 'body' },
					};
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

				async internalPost( url, urlParams, bodyParams ) {
					expect( url ).to.equal( 'https://wiki.test/w/rest.php/foo/BAR%2FBAZ/qux' );
					expect( urlParams ).to.eql( {} );
					expect( bodyParams ).to.eql( {} );
					return {
						status: 200,
						headers: {},
						body: { the: 'body' },
					};
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

			await expect( getJson( session, path, params ) )
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

			await expect( getJson( session, path, params ) )
				.to.be.rejectedWith( InvalidPathParams, 'Ambiguous path param {qux}' )
				.and.eventually.include( { path, paramName: 'qux', params } );
		} );

	} );

} );
