import acm.program.ConsoleProgram;

import java.util.Random;

public class Pr37 extends ConsoleProgram {

    public void run(){

        int a = 5;
        while (a!=0) {
            int userNum = readInt("Enter your choice number: ");
            ruletka(userNum);
            a = readInt("Play Again - 1, End - 0. Enter Your Decision: ");
            if(a == 0) {
                println("Game Over");
            }
        }
    }

    private void ruletka(int userNum){

        Random rul = new Random();
        int randNum = rul.nextInt(36);

        if (userNum == randNum){
            println("Winner Number: " + randNum);
            println("Congratulations, You Won!");
        } else {
            println("Winner Number: " + randNum);
            println("We're Sorry, You Lost!");
        }
    }
}
