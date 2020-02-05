/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const CharsetDefinedAudit = require('../../../audits/dobetterweb/charset.js');
const assert = require('assert');
const networkRecordsToDevtoolsLog = require('../../network-records-to-devtools-log.js');

/* eslint-env jest */

function generateArtifacts(htmlContent, contentTypeValue = 'text/html') {
  const finalUrl = 'https://example.com/';
  const mainResource = {
    url: finalUrl,
    responseHeaders: [
      {name: 'content-type', value: contentTypeValue},
    ],
  };
  const devtoolsLog = networkRecordsToDevtoolsLog([mainResource]);
  return {
    devtoolsLogs: {[CharsetDefinedAudit.DEFAULT_PASS]: devtoolsLog},
    URL: {finalUrl},
    MainDocumentContent: htmlContent,
  };
}

describe('Charset defined audit', () => {
  it('succeeds where the page contains the charset meta tag', () => {
    const htmlContent = '<meta charset="utf-8" />';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 1);
    });
  });

  it('succeeds when the page has the charset defined in the content-type meta tag', () => {
    const htmlContent = '<meta http-equiv="Content-type" content="text/html; charset=utf-8" />';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 1);
    });
  });

  it('succeeds when the page has the charset defined in the content-type http header', () => {
    const htmlContent = '<meta http-equiv="Content-type" content="text/html" />';
    const contentTypeVal = 'text/html; charset=UTF-8';
    const artifacts = generateArtifacts(htmlContent, contentTypeVal);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 1);
    });
  });

  it('succeeds when the page has the charset defined via BOM', () => {
    const htmlContent = '\ufeff<meta http-equiv="Content-type" content="text/html" />';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 1);
    });
  });

  it('fails when the page does not have charset defined', () => {
    const htmlContent = '<meta http-equiv="Content-type" content="text/html" />';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 0);
    });
  });

  it('fails when the page has charset defined too late in the page', () => {
    const bigString = new Array(1024).fill(' ').join('');
    const htmlContent = '<html><head>' + bigString + '<meta charset="utf-8" /></head></html>';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 0);
    });
  });

  it('passes when the page has charset defined almost too late in the page', () => {
    const bigString = new Array(900).fill(' ').join('');
    const htmlContent = '<html><head>' + bigString + '<meta charset="utf-8" /></head></html>';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 1);
    });
  });

  it('fails when charset only partially defined in the first 1024 bytes of the page', () => {
    const prelude = '<html><head>';
    const charsetHTML = '<meta charset="utf-8" />';
    // 1024 bytes should be halfway through the meta tag
    const bigString = new Array(1024 - prelude.length - charsetHTML.length / 2).fill(' ').join('');
    const htmlContent = prelude + bigString + charsetHTML + '</head></html>';
    const artifacts = generateArtifacts(htmlContent);
    const context = {computedCache: new Map()};
    return CharsetDefinedAudit.audit(artifacts, context).then(auditResult => {
      assert.equal(auditResult.score, 0);
    });
  });
});

describe('Charset regex check', () => {
  it('passes if html charset declaration has no quotes', () => {
    const charsetHTML = '<meta charset=utf-8 />';
    assert.equal(CharsetDefinedAudit.CHARSET_HTML_REGEX.test(charsetHTML), true);
  });

  it('passes if html charset declaration tag is left open', () => {
    const charsetHTML = '<meta charset="utf-8">';
    assert.equal(CharsetDefinedAudit.CHARSET_HTML_REGEX.test(charsetHTML), true);
  });

  it('fails if charset declaration has an empty value', () => {
    const charsetHTTP = 'text/html; chartype=';
    assert.equal(CharsetDefinedAudit.CHARSET_HTTP_REGEX.test(charsetHTTP), false);
  });
});
