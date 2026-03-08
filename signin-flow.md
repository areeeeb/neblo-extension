- check if the user is signed in (do some cookie lookup or some shit to verify)
- if the user is signed in, exit
- if the user is not signed in then continue
- open relay.amazon.com in a tab (now this tab would be the login tab)
- if it has getElementByText('a', 'Sign in') (it confirms that we are on the login page) then click it
- <input type="email" maxlength="128" id="ap_email" autocomplete="username" name="email" spellcheck="false" class="a-input-text a-span12 auth-autofocus auth-required-field auth-require-claim-validation" aria-required="true">
    - above is the email field.. gotta do human input on the above field
- <input id="continue" aria-describedby="legalTextRow" class="a-button-input" type="submit" aria-labelledby="continue-announce">
    - click the above continue button
- <input type="password" maxlength="1024" id="ap_password" autocomplete="current-password" name="password" spellcheck="false" class="a-input-text a-span12 auth-autofocus auth-required-field" aria-required="true">
    - above is the password field.. gotta do human input on the above field
- <input id="signInSubmit" class="a-button-input" type="submit" aria-labelledby="auth-signin-button-announce">
    - click the above sign in button
- <input type="tel" maxlength="6" required="" id="input-box-otp" autocomplete="off" spellcheck="false" class="a-input-text cvf-widget-input cvf-widget-input-code single-input-box-otp">
    - above is the otp field.. if it exists thengotta do human input on the above field
- 


