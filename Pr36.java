import acm.program.ConsoleProgram;

import java.util.Random;

public class Pr36 extends ConsoleProgram {

    public void run(){

        int counter = 0;
        int n = 100000;
        int borjCounter = 0;
        double avg = 0;

        for (int a = 0; a < n; a++){
            int b = coinSimulation();
            if (b==1){

                borjCounter++;
                if (borjCounter == 3){

                    counter++;

                }

            } else {
                borjCounter = 0;
            }


        }

        avg = (double) n /  (double) counter;

        if (counter>0) {
            println("სულ მონეტა ავაგდეთ " + n + "-ჯერ");
            println("სულ 3ჯერ ზედიზედ ბორჯღალი ამოვიდა " + counter +"-ჯერ");
            println("საშუალოდ " + avg + "-ჯერ უნდა ავაგდოთ მონეტა რომ 3ჯერ ამოვიდეს ზედიზედ ბორჯღალი!");
        } else {
            println(n + " აგდებით ტესტირების შემდეგ 3ჯერ არ ამოვიდა ბორჯღალი ზედიზედ");
        }
    }

    private int coinSimulation(){

        Random a = new Random();
        double toss = a.nextDouble();
        int coinSide = 0;
        if (toss > 0.5){

            coinSide = 1;
            //ბორჯღალი

        } else {
            coinSide = 0;
            //რიცხვი
        }
        return coinSide;
    }

}
