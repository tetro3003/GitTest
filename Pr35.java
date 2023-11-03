import acm.program.ConsoleProgram;

import java.util.Random;

public class Pr35 extends ConsoleProgram {

    public void run(){

        double b = 0;
        int c = 0;

        for (int a = 0; a<1000000; a++){
            c += 1;
            if (coinSimulation()==1){
                b += 1;
            }

        }

        println("1000 მონეტის აგდების შემდეგ: ");
        println("ბორჯღალი ამოვიდა " + b + "-ჯერ");
        println("რიცხვი ამოვიდა " + (c-b) + "-ჯერ");

        println("საშუალოდ " + (c/b) + " აგდების შემდეგ ამოვა ბორჯღალი!");

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
