/* eslint-env mocha */

import {
	path,
} from '../../index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use( chaiAsPromised );

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
