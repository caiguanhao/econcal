# econcal

Freely access fxstreet API (<http://api.fxstreet.com>) without credentials.

## Usage

```
# start the server:
node econcal.js

# once the server is listening on port 6000, you can make your API calls like this:
curl 'http://localhost:6000/v4/eventdate/mini?view=1&start=20190101&end=20190101'
```