/**
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @fileoverview Audits a page to ensure charset it configured properly. 
 * It must be defined within the first 1024 bytes of the HTML document, defined in the HTTP header, or in a BOM.
 */
'use strict';

const Audit = require('../audit.js');
const i18n = require('../../lib/i18n/i18n.js');
const MainResource = require('../../computed/main-resource.js');
const CONTENT_TYPE_HEADER = 'content-type';
const CHARSET_META_REGEX = /<meta.*charset=.*>/gm;
const CHARSET_HTTP_REGEX = /charset=.*/gm;

const UIStrings = {
  /** Title of a Lighthouse audit that provides detail on if the charset is set properly for a page. This title is shown when the charset is defined correctly. */
  title: 'Properly defines charset',
  /** Title of a Lighthouse audit that provides detail on if the charset is set properly for a page. This title is shown when the charset meta tag is missing or defined too late in the page. */
  failureTitle: 'Charset element is missing or occurs too late on the page',
  /** Description of a Lighthouse audit that tells the user why the charset needs to be defined early on. */
  description: 'My description that I haven\'t written yet',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

class CharsetDefined extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'charset',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['MainDocumentContent', 'devtoolsLogs'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>} 
   */
  static audit(artifacts, context) {
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    return MainResource.request({devtoolsLog, URL: artifacts.URL}, context)
    .then(mainResource => {
      let charsetIsSet = false;
      // Check the http header 'content-type' to see if charset is defined there
      if (mainResource.responseHeaders) {
        const contentTypeHeader = mainResource.responseHeaders
          .find(header => header.name.toLowerCase() === CONTENT_TYPE_HEADER);

        if (contentTypeHeader)
          charsetIsSet = contentTypeHeader.value.match(CHARSET_HTTP_REGEX) != null;
      }

      // Check if there is a BOM byte marker
      const BOM_FIRSTCHAR = 65279;
      charsetIsSet = charsetIsSet || artifacts.MainDocumentContent.charCodeAt(0) === BOM_FIRSTCHAR;

      // Check if charset is defined within the first 1024 characters(~1024 bytes) of the HTML document
      charsetIsSet = charsetIsSet || artifacts.MainDocumentContent.slice(0,1024).match(CHARSET_META_REGEX) != null;
      
      return {
        score: Number(charsetIsSet),
      };
    });
  }
}

module.exports = CharsetDefined;
module.exports.UIStrings = UIStrings;