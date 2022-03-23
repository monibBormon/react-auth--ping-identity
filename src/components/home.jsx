import React, { useState } from 'react';
import authClient from '../sdk/api'
import PropTypes from 'prop-types';
import _ from "lodash";
import config from "../config";
import InfoTable from './InfoTable';

const Home = () => {
    const [access_token, setAccess_token] = useState(null);
    const [id_token, setId_token] = useState(null);
    const [idTokenJson, setIdTokenJson] = useState(null);
    const [userInfo, setUserInfo] = useState(null);
    const [errorMessage, setErroMessage] = useState("")



    const handleSignIn = () => {
        clearSession();
        let state = authClient.generateRandomValue();
        let nonce = authClient.generateRandomValue();
        // Store state and nonce parameters into the session, so we can retrieve them after
        // user will be redirected back with access token or code (since react state is cleared in this case)
        sessionStorage.setItem("state", state);
        sessionStorage.setItem("nonce", nonce);

        authClient.authorize(state, nonce);
    }

    const handleSignOff = () => {
        if (id_token) {
            authClient.signOff(id_token, sessionStorage.getItem("state"));
        }
        clearSession();
    }

    const clearSession = () => {
        setAccess_token(null)
        setId_token(null)
        setErroMessage("")
    }


    const verifyToken = (id_token) => {
        authClient.verifyIdToken(id_token,
            {
                nonce: sessionStorage.getItem("nonce"),
                maxAge: config.maxAge
            })
            .then(idToken => {
                setIdTokenJson(idToken)
            })
            .catch(error => {
                setErroMessage("Id token verification failed. " + _.get(error,
                    'error_description', _.get(error, 'message', error)))
            })
    }

    const handleUserInfo = (access_token) => {
        authClient.getUserInfo(access_token)
            .then(result => {
                setUserInfo(result)
            })
            .catch(error => {
                const errorDetail = _.get(error, 'details[0].code', null);
                if (_.isEqual(errorDetail, 'INVALID_VALUE')) {
                    if (_.get(error, 'details[0].message', null).includes(
                        "Access token expired")) {
                        setErroMessage('Your access token is expired. Please login again.')
                    } else {
                        setErroMessage(_.get(error, 'details[0].message', null))
                    }
                } else if (errorDetail) {
                    setErroMessage(errorDetail + _.get(error, 'details[0].message', null))
                } else if (_.get(error, 'error', null) || _.get(error,
                    'error_description', null)) {
                    setErroMessage(_.get(error, 'error', null) + ': ' + _.get(error,
                        'error_description', null))
                }
                return Promise.reject(error);
            })
    }


    const hashes = authClient.parseHash();
    if (hashes.error && hashes.error_description) {
        setErroMessage(hashes.error + ': ' + hashes.error_description)
        return;
    }

    const stateMatch = window.location.href.match('[?#&]state=([^&]*)');
    if (stateMatch && !stateMatch[1] &&
        !_.isEqual(stateMatch[1], sessionStorage.getItem("state"))) {
        setErroMessage("State parameter mismatch. ")
        clearSession();
        return;
    }

    const codeMatch = window.location.href.match('[?#&]code=([^&]*)');
    // Implicit flow: access token is present in URL
    if (hashes.access_token) {
        setAccess_token(hashes.access_token)
        handleUserInfo(hashes.access_token);
    }
    // Authorization code flow: access code is present in URL
    else if (codeMatch && codeMatch[1]) {
        authClient.getAccessToken(codeMatch[1])
            .then(token => {
                setAccess_token(token.access_token)
                setId_token(token.id_token)
                handleUserInfo(token.access_token);
                verifyToken(token.id_token);
            })
            .catch(error => {
                setErroMessage("Couldn't get an access token. " + _.get(error,
                    'error_description', _.get(error, 'message', '')))
            });
    }

    if (hashes.id_token) {
        verifyToken(hashes.id_token);
    }
    // Replace current URL without adding it to history entries
    window.history.replaceState({}, '', '/');




    // send api request 

    const handleApiRequest = (e) => {
        e.preventDefault();
        console.log(access_token, "jwt", localStorage.getItem('idToken'));
        fetch(`https://pbiembedpocw.azurewebsites.net/api/pbiembed?code=TXYa2eGqBqDk2DD0jWgY4SQW9k410bfa0NNb3nOplCqULx4Ns8Spjw==`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`
            },
            body: JSON.stringify(localStorage.getItem('idToken'))
        }).then(res => res.json())
            .then(data => console.log(data))
    }

    const alert = errorMessage && (
        <div className="alert alert-danger">{errorMessage}</div>
    );

    const content = access_token ?
        (
            <div className="home-app">
                <em>
                    Congratulations! This is a secure resource.
                </em>
                <p />
                <div className="input-field">
                    <button type="button" onClick={handleSignOff}> Sign Off
                    </button>
                </div>
                <div>
                    <form onSubmit={handleApiRequest}>
                        <button type='submit'>Request BI Content</button>
                    </form>
                </div>
                <InfoTable btnLabel={'User Information'} data={userInfo} />
                <InfoTable btnLabel={'User Id Token Information'}
                    data={idTokenJson} />
            </div>
        ) :
        (
            <div id="signInView">
                <p>You are not currently authenticated. Click Sign On to get
                    started.</p>
                <div className="input-field">
                    <button type="button" onClick={handleSignIn}>Sign On
                    </button>
                </div>
            </div>
        );

    return (
        <div className="container">
            <h1>PingOne for Customers OIDC Sample</h1>
            {alert}
            {content}
        </div>
    );
};


Home.propTypes = {
    environmentId: PropTypes.string.isRequired,
    clientId: PropTypes.string.isRequired,
    clientSecret: PropTypes.string,
    scope: PropTypes.string.isRequired,
    responseType: PropTypes.string,
    tokenEndpointAuthMethod: PropTypes.string.isRequired,
    grantType: PropTypes.string,
    prompt: PropTypes.string,
    redirectUri: PropTypes.string,
    logoutRedirectUri: PropTypes.string,
    maxAge: PropTypes.number
};

export default Home;