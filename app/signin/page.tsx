import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import SignInForm from "./signin-form";

export default async function SignInPage() {
  if (await isAuthenticated()) redirect("/");
  return <SignInForm />;
}
