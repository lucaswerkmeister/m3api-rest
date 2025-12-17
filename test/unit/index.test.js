/* eslint-env mocha */

import { Session } from 'm3api/core.js';
import {
	InvalidStatusError,
	getJson,
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

} );

describe( 'getJson', () => {

	it( 'makes a request with the right URL and headers and returns the body', async () => {
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

		const response = await getJson( session, '/foo', {
			userAgent: 'test-user-agent',
		} );

		expect( called ).to.be.true;
		expect( response ).to.eql( { the: 'body' } );
	} );

	describe( 'checkResponseStatus', () => {

		describe( 'throws InvalidStatusError for', () => {

			for ( const status of [ 0, 99, 600, 599.9, 2000, 'not a number' ] ) {
				it( JSON.stringify( status ), async () => {
					let called = false;
					const session = new class TestSession extends Session {

						async internalGet() {
							expect( called ).to.be.false;
							called = true;
							return {
								status: status,
								headers: {},
								body: { the: 'body' },
							};
						}

					}( 'wiki.test', {}, { userAgent: 'test-user-agent' } );

					await expect( getJson( session, '/foo' ) )
						.to.be.rejectedWith( InvalidStatusError )
						.and.eventually.have.property( 'status', status );
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

} );
