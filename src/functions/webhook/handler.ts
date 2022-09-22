import "source-map-support/register";
import { formatJSONResponse } from "@libs/apiGateway";
import {APIGatewayProxyHandler,APIGatewayProxyEvent,Context,APIGatewayProxyResult,} from "aws-lambda";
import { connectToDatabase } from "../db";
import AWS from "aws-sdk"; // eslint-disable-line import/no-extraneous-dependencies
import { getAWSAccountId } from "../keyStoreModule";
import crypto from "crypto";
import { getMailgunAPIKey } from "../keyStoreModule";

const sns = new AWS.SNS();
interface SnsParameter {
  Message: string;
  Subject?: string;
  TopicArn: string;
}

interface Payload {
  Provider: string;
  timestamp: string | number;
  type: string;
}


const verify = ({
  signingKey,
  timestamp,
  token,
  signature,
}: {
  signingKey: string;
  timestamp: string;
  token: string;
  signature: string;
}): Boolean => {
  const encodedToken = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp.concat(token))
    .digest("hex");
  return encodedToken === signature;
};


const webhook: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  let body = JSON.parse(event.body);
  let message: string;

  const apiKey: string = await getMailgunAPIKey();
  const signingKey = apiKey;

  // Get a MongoDBClient.
  const client = await connectToDatabase();

  //Verify if the request is from Mailgun
  try {
    const {
      timestamp,
      token,
      signature,
    }: { timestamp: string; token: string; signature: string } = body.signature;
    const verifyEvent: Boolean = verify({
      signingKey,
      timestamp,
      token,
      signature,
    });

    if (!verifyEvent) {
      console.log("Could not verify this request is from mailgun");
      return formatJSONResponse._400({
        message: "Could not verify this request is from mailgun",
      });
    }
  } catch (error) {
    console.log(error.message, error.stack);
    if (error instanceof TypeError) {
      // TypeError: Cannot read property 'signature' of undefined is thrown when
      // the request is not from mailgun or the signature is not valid.
      return formatJSONResponse._400({
        message: "Could not verify this request is from mailgun",
      });
    }
    return formatJSONResponse._400({ message: "Request not permitted" });
  }

  // Get AWS account ID from ssm parameter store and set it as a variable
  const accountId: string = await getAWSAccountId();

  // Validate payload using the Mailgun payload schema
  const payload: Payload = {
    Provider: "Mailgun",
    timestamp: body.signature.timestamp || "No time stamp",
    type: `Email ${body["event-data"].event}` || "delivered status unknown",
  };

  // Validate SNS parameter to be sent using interface typing
  const params: SnsParameter = {
    Message: JSON.stringify(payload),
    TopicArn: `arn:aws:sns:us-east-1:${accountId}:emailStatuses`,
  };

  // Send the message to SNS
  try {
    sns.publish(params).promise();
    console.log("push sent");
    console.log(payload);
    message = "Success";

    // Store the event in the database
    const mailgunEvents = client
      .db("email-tracker")
      .collection("mailgun-events");
    // Insert the event into the database
    let dbOperation = await mailgunEvents.insertOne(body);
    if (dbOperation) {
      console.log("Mailgun event stored in database");
    }
    return formatJSONResponse._200({ message: message });
  } catch (error) {
    // If the message fails to send, log the error
    console.log(error.message);
    message = "Error occured";
    return formatJSONResponse._400({ message: message });
  }
};

export const main = webhook;
