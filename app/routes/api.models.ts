import {  json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { initializeModelList } from '~/utils/tools';

export async function loader({context}: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const  modelList = await initializeModelList(env);
  return json(modelList);
}
