- app name is `Practical Machinist Trivia`
- for desktop optimize for `1440p`
- for mobile the minimal size is `360px CSS pixels`
- translations - yes [english]
- follow the instructions in `./AGENTS.md`

# Additional notes

- when you load the app want to load the first question and also a buffer of questions from every difficulty level. When the player answers the 1st question he is served the next one from the buffer, depending on the requirements and in the same time load the next batch of questions from BA for the buffer for when the user has answered 2nd question.
- You can have multiple sponsor questions and all must be in the end.
- the logo in the header on right is the logo for the sponsor and will be provided from BE on app load .
- the sponsor question should have a countdown timer and the time should be displayed in the UI in the format MM:SS. Should start after the timer for the regular questions is expired.
- the number of people that will win something on every game is provided in admin panel.
- in the leaderboard the current player is shown with his position and the total score.
- in booth display tv there is no current player.
- look into admin panel and backend related specification if it is required to implement the frontend
- save the data fields on registration to storage, so if the user logs in again it will be pre-filled.
- the sponsor video will come from BE as url
- the booth display must be without token and free to access to everybody
- there is fields for brand color and text color in admin panel, sponsor name and url, logo, and video url

## Backend
- for developing purposes use mock-backend you can find in `C:/Users/twrkh/Projects/backend-mock`
- if there is changes made in frontend always check if they are reflected in backend
