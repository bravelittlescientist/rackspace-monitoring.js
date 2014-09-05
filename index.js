var request = require('request');
var async = require('async');
var virgo = require('virgo.js');
var config = require('./config');
var constants = require('./constants');
var identity = require('./lib/identity');


var identityClient = identity.createClient(config.username, config.apiKey);
    accountId = config.accountId,
    agentServiceApiUrl = 'https://monitoring.api.rackspacecloud.com/v1.0/' + accountId + '/agent_tokens',
    agentLabel = 'virgo-js-agent';

function filterByVirgoAgentLabel(agentToken) {
  return agentToken.label == agentLabel;
}

async.auto({
  getIdentityToken: function getIdentityToken(callback) {
    identityClient.getToken(function(err, token) {
      callback();
    });
  },

  deleteVirgoTokens: ['getIdentityToken', function deleteExistingVirgoTokens(callback) {
    // This will be useful for testing. Just good to get things working for now.
    var tokensToDelete,
        deletionUrl;

    identityClient.sendAuthenticatedApiRequest(agentServiceApiUrl, "GET", {}, function(err, agentTokens) {
      tokensToDelete = agentTokens.values.filter(filterByVirgoAgentLabel);

      async.each(tokensToDelete,
        function(token, callback) {
          deletionUrl = agentServiceApiUrl + '/' + token.id;

          identityClient.sendAuthenticatedApiRequest(deletionUrl, "DELETE", {}, callback); 
        },
        function(err) {
          callback();
        }
      );
    });
  }],

  createVirgoToken: ['deleteVirgoTokens', function createVirgoAgentLabelToken(callback) {
    identityClient.sendAuthenticatedApiRequest(agentServiceApiUrl, "POST", {label: agentLabel}, callback);
  }],

  getVirgoAgentToken: ['createVirgoToken', function getVirgoAgentLabelToken(callback) {
    var virgoLabeledToken;

    identityClient.sendAuthenticatedApiRequest(agentServiceApiUrl, "GET", {}, function(err, agentTokens) {
      if (err) {
        callback(err);
        return;
      }
     
      virgoLabeledToken = agentTokens.values.filter(filterByVirgoAgentLabel)[0];
      callback(null, virgoLabeledToken);
    });
  }],

  deployVirgoAgent: ['getVirgoAgentToken', function createVirgoAgent(callback, results) {
    var agent = virgo.agent;
    var heartbeats = virgo.heartbeats;
    
    var agentOptions = {
      host: constants.dfw,
      token: results.getVirgoAgentToken.token
    };
    
    agent([heartbeats()], agentOptions).run();
    
    callback();
  }]
}, function (err) {
  if (err) {
    console.log(err);
    return;
  }
});
