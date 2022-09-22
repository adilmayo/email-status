import "source-map-support/register";
import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/apiGateway";
import { formatJSONResponse } from "@libs/apiGateway";
import { middyfy } from "@libs/lambda";
import schema from "./schema";
import { getMailgunAPIKey, getMailgunDomain } from "../keyStoreModule";
import formData from "form-data";
import Mailgun from "mailgun.js";

const mailgun = new Mailgun(formData);
const sendEmail: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event: { body: any; }
) => {const apiKey: string = await getMailgunAPIKey();
  const apiDomain: string = await getMailgunDomain();

  const mg = mailgun.client({
    username: "api",
    key: apiKey,
  });

  return mg.messages
    .create(apiDomain, event.body)
    .then((msg) => {
      console.log("Email Sent and msg is %o", msg);
      return formatJSONResponse._200(msg);
    })
    .catch((err) => {
      throw new Error('Error while sending')
      return formatJSONResponse._400(err);
    });
};

export const main = middyfy(sendEmail);
